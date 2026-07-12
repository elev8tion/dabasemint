// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::api::dialog;
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, State, Submenu};

/// Shared app state: the discovered agent-proxy port + the spawned child process.
struct AppState {
  proxy_port: Arc<Mutex<Option<u16>>>,
  proxy_child: Arc<Mutex<Option<Child>>>,
}

impl AppState {
  fn new() -> Self {
    Self {
      proxy_port: Arc::new(Mutex::new(None)),
      proxy_child: Arc::new(Mutex::new(None)),
    }
  }
}

fn main() {
  let quit = CustomMenuItem::new("quit".to_string(), "Quit");
  let close = CustomMenuItem::new("close".to_string(), "Close");
  let submenu = Submenu::new("File", Menu::new().add_item(quit).add_item(close));
  let menu = Menu::new()
    .add_native_item(MenuItem::Copy)
    .add_item(CustomMenuItem::new("hide", "Hide"))
    .add_submenu(submenu);

  let state = AppState::new();

  tauri::Builder::default()
    .menu(menu)
    .manage(state)
    .setup(move |app| {
      let is_dev = cfg!(debug_assertions) || std::env::var("TAURI_DEV").is_ok();

      if is_dev {
        println!("[dabasemint] Dev mode — agent proxy provided by external `npm run serve` (beforeDevCommand)");
      } else {
        println!("[dabasemint] Production build — spawning bundled agent proxy sidecar");
        let app_handle = app.app_handle();
        match spawn_agent_proxy(&app_handle) {
          Some(port) => {
            println!("[dabasemint] Agent proxy sidecar ready on port {}", port);
            if let Some(st) = app_handle.try_state::<AppState>() {
              if let Ok(mut guard) = st.proxy_port.lock() {
                *guard = Some(port);
              }
            }
          }
          None => {
            eprintln!("[dabasemint] WARNING: agent proxy sidecar could not start. Agent features will be unavailable. Ensure Node.js is installed.");
          }
        }
      }
      Ok(())
    })
    .on_menu_event(|event| {
      match event.menu_item_id() {
        "quit" => {
          let ah = event.window().app_handle();
          kill_agent_proxy(&ah);
          std::process::exit(0);
        }
        "close" => {
          let ah = event.window().app_handle();
          kill_agent_proxy(&ah);
          let _ = event.window().close();
        }
        _ => {}
      }
    })
    .invoke_handler(tauri::generate_handler![
      pick_folder_native,
      read_toolchest_native,
      read_file_native,
      get_agent_proxy_port,
      restart_agent_proxy,
      is_agent_proxy_managed,
      reveal_in_finder,
      save_toolchest_metadata,
      load_toolchest_metadata
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// ==================== AGENT PROXY SIDECAR ====================

/// Locate the agent-proxy.mjs script: bundled resource in release, dev path fallback.
fn find_proxy_script(app: &tauri::AppHandle) -> Option<PathBuf> {
  if let Some(p) = app.path_resolver().resolve_resource("agent-proxy.mjs") {
    if p.exists() {
      return Some(p);
    }
  }
  // Dev fallback: repo root
  let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("agent-proxy.mjs");
  if dev.exists() {
    return Some(dev);
  }
  // CWD fallback
  if PathBuf::from("agent-proxy.mjs").exists() {
    return Some(PathBuf::from("agent-proxy.mjs"));
  }
  None
}

/// Locate a usable `node` binary.
fn find_node() -> Option<String> {
  for candidate in ["node", &which_node_from_env().unwrap_or_default()] {
    if candidate.is_empty() {
      continue;
    }
    if Command::new(candidate).arg("--version").output().is_ok() {
      return Some(candidate.to_string());
    }
  }
  None
}

fn which_node_from_env() -> Option<String> {
  // Allow override via env var (useful for bundlers / specific node paths)
  std::env::var("DABASEMINT_NODE").ok()
}

fn agent_port_file() -> Option<PathBuf> {
  let home = dirs_home()?;
  Some(home.join(".dabasemint").join("agent-proxy-port.json"))
}

fn dirs_home() -> Option<PathBuf> {
  std::env::var_os("HOME")
    .map(PathBuf::from)
    .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}

/// Spawn the agent proxy sidecar (node + agent-proxy.mjs) and wait for its port file.
fn spawn_agent_proxy(app: &tauri::AppHandle) -> Option<u16> {
  // Kill any previously-managed child first (used by restart path).
  kill_agent_proxy(app);

  let script = find_proxy_script(app)?;
  let node = find_node()?;

  // Resolve the project root so the sidecar can import ./src/agent-provider.mjs
  let working_dir = script.parent()?.to_path_buf();

  let mut cmd = Command::new(node);
  cmd.arg(&script);
  cmd.current_dir(&working_dir);
  cmd.env("AGENT_PROXY_PORT", std::env::var("DABASEMINT_AGENT_PORT").unwrap_or_else(|_| "0".to_string()));
  cmd.stdin(Stdio::null());
  cmd.stdout(Stdio::null());
  cmd.stderr(Stdio::null());

  let child = cmd.spawn().ok()?;

  if let Some(st) = app.try_state::<AppState>() {
    if let Ok(mut guard) = st.proxy_child.lock() {
      *guard = Some(child);
    }
  }

  // Wait for the port file to appear (the sidecar writes it on listen).
  wait_for_port(Duration::from_secs(8))
}

/// Poll the port file until a fresh port appears or we time out.
fn wait_for_port(timeout: Duration) -> Option<u16> {
  let port_file = agent_port_file()?;
  let start = Instant::now();

  // Record the file's previous mtime/contents so we detect a NEW write (not stale).
  let prev_mtime = fs::metadata(&port_file).ok().and_then(|m| m.modified().ok());

  while start.elapsed() < timeout {
    std::thread::sleep(Duration::from_millis(120));
    if let Ok(content) = fs::read_to_string(&port_file) {
      let is_fresh = fs::metadata(&port_file)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|mt| Some(mt) != prev_mtime)
        .unwrap_or(true);
      if !is_fresh {
        continue;
      }
      if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
        if let Some(p) = v.get("port").and_then(|p| p.as_u64()) {
          if (1u64..=65535).contains(&p) {
            return Some(p as u16);
          }
        }
      }
    }
  }
  None
}

/// Kill the managed child process (best-effort). Clears the stored port + child.
/// Enhanced for B4: unconditional port file cleanup first, pkill safeguard for zombies,
/// double cleanup. Addresses orphaned node processes on restart/force-quit.
fn kill_agent_proxy(app: &tauri::AppHandle) {
  // ALWAYS clean port file FIRST to prevent stale port reuse on next spawn
  if let Some(pf) = agent_port_file() {
    let _ = fs::remove_file(&pf);
  }

  if let Some(st) = app.try_state::<AppState>() {
    if let Ok(mut child_guard) = st.proxy_child.lock() {
      if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        println!("[dabasemint] Agent proxy sidecar stopped");
      }
    }
    if let Ok(mut port_guard) = st.proxy_port.lock() {
      *port_guard = None;
    }
  }

  // Safeguard against zombie sidecars (Unix/Mac primary target for this project)
  #[cfg(unix)]
  {
    let _ = Command::new("pkill")
      .arg("-f")
      .arg("agent-proxy.mjs")
      .status();
  }

  // Final best-effort port file cleanup
  if let Some(pf) = agent_port_file() {
    let _ = fs::remove_file(pf);
  }
}

#[tauri::command]
async fn get_agent_proxy_port(state: State<'_, AppState>) -> Result<Option<u16>, String> {
  let guard = state.proxy_port.lock().map_err(|e| e.to_string())?;
  Ok(*guard)
}

/// Returns true if the app is managing a spawned sidecar (production), false in dev.
#[tauri::command]
async fn is_agent_proxy_managed(state: State<'_, AppState>) -> Result<bool, String> {
  let guard = state.proxy_child.lock().map_err(|e| e.to_string())?;
  Ok(guard.is_some())
}

/// Restart (or start) the agent proxy sidecar and return the new port.
#[tauri::command]
async fn restart_agent_proxy(app: tauri::AppHandle) -> Result<Option<u16>, String> {
  let app_for_spawn = app.clone();
  let port = tauri::async_runtime::spawn_blocking(move || spawn_agent_proxy(&app_for_spawn))
    .await
    .map_err(|e| e.to_string())?;
  if let Some(p) = port {
    if let Some(st) = app.try_state::<AppState>() {
      if let Ok(mut guard) = st.proxy_port.lock() {
        *guard = Some(p);
      }
    }
  }
  Ok(port)
}

// ==================== NATIVE FS / DIALOG COMMANDS ====================

/// Opens a native folder picker and returns the selected path.
#[tauri::command]
async fn pick_folder_native() -> Result<Option<String>, String> {
  let path = dialog::blocking::FileDialogBuilder::new()
    .set_title("Select a /forge toolchest folder")
    .pick_folder();

  match path {
    Some(p) => Ok(Some(p.to_string_lossy().to_string())),
    None => Ok(None),
  }
}

/// Reads key files from a toolchest directory natively.
#[tauri::command]
async fn read_toolchest_native(path: String) -> Result<serde_json::Value, String> {
  let base = PathBuf::from(&path);

  if !base.exists() || !base.is_dir() {
    return Err(format!("Path is not a directory: {}", path));
  }

  let mut result = serde_json::json!({
    "name": base.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
    "path": path,
    "modules": [],
    "has_forge_state": false,
    "has_readme": false,
    "contracts": false,
  });

  // Check for .forge-state.md
  let forge_state_path = base.join(".forge-state.md");
  if forge_state_path.exists() {
    if let Ok(content) = fs::read_to_string(&forge_state_path) {
      result["has_forge_state"] = serde_json::json!(true);
      result["forge_state_preview"] = serde_json::json!(content.lines().take(20).collect::<Vec<_>>().join("\n"));
    }
  }

  // Check for README.md
  let readme_path = base.join("README.md");
  if readme_path.exists() {
    result["has_readme"] = serde_json::json!(true);
    if let Ok(content) = fs::read_to_string(&readme_path) {
      result["readme_preview"] = serde_json::json!(content.chars().take(800).collect::<String>());
    }
  }

  // Discover numbered modules
  let mut modules: Vec<String> = vec![];
  if let Ok(entries) = fs::read_dir(&base) {
    for entry in entries.flatten() {
      let file_name = entry.file_name();
      let name = file_name.to_string_lossy().to_string();
      if name.len() >= 3
        && name.chars().take(3).all(|c| c.is_ascii_digit())
        && name.contains('-')
        && entry.path().is_dir()
      {
        modules.push(name);
      }
    }
  }
  modules.sort();
  result["modules"] = serde_json::json!(modules);

  // Check for contracts
  let contracts_path = base.join("00-shared/contracts.md");
  if contracts_path.exists() {
    result["contracts"] = serde_json::json!(true);
  }

  Ok(result)
}

/// Reads any text file inside a toolchest (used for contracts.md preview).
#[tauri::command]
async fn read_file_native(path: String) -> Result<String, String> {
  match fs::read_to_string(&path) {
    Ok(content) => Ok(content),
    Err(e) => Err(format!("Failed to read file: {}", e)),
  }
}

/// Reveal folder in OS file manager (Finder/Explorer).
#[tauri::command]
async fn reveal_in_finder(_app: tauri::AppHandle, path: String) -> Result<(), String> {
  let p = std::path::PathBuf::from(&path);
  if !p.exists() {
    return Err("Path does not exist".to_string());
  }
  // Use std process to reveal (macOS open -R for reveal in Finder)
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .args(["-R", &path])
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("explorer")
      .arg(&path)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(all(unix, not(target_os = "macos")))]
  {
    std::process::Command::new("xdg-open")
      .arg(&path)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

// ==================== APP DATA METADATA ====================

fn get_app_metadata_path(app: &tauri::AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
  let dir = app.path_resolver().app_data_dir().ok_or("no app data dir")?;
  let _ = std::fs::create_dir_all(&dir);
  Ok(dir.join(name))
}

#[tauri::command]
async fn save_toolchest_metadata(app: tauri::AppHandle, data: serde_json::Value) -> Result<(), String> {
  let path = get_app_metadata_path(&app, "toolchests.json")?;
  let content = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
  std::fs::write(&path, content).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
async fn load_toolchest_metadata(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
  let path = get_app_metadata_path(&app, "toolchests.json")?;
  if path.exists() {
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&s).unwrap_or(serde_json::json!([])))
  } else {
    Ok(serde_json::json!([]))
  }
}
