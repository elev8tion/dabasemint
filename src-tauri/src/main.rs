// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::api::dialog;
use tauri::api::process::{Child, Command, CommandEvent};
use tauri::{CustomMenuItem, Manager, Menu, MenuItem, State, Submenu};

struct AgentProxyState(Arc<Mutex<Option<u16>>>, Arc<Mutex<Option<Child>>>);

fn main() {
  let quit = CustomMenuItem::new("quit".to_string(), "Quit");
  let close = CustomMenuItem::new("close".to_string(), "Close");
  let submenu = Submenu::new("File", Menu::new().add_item(quit).add_item(close));
  let menu = Menu::new()
    .add_native_item(MenuItem::Copy)
    .add_item(CustomMenuItem::new("hide", "Hide"))
    .add_submenu(submenu);

  let proxy_port: Arc<Mutex<Option<u16>>> = Arc::new(Mutex::new(None));
  let proxy_port_clone = proxy_port.clone();
  let proxy_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
  let proxy_child_clone = proxy_child.clone();

  tauri::Builder::default()
    .menu(menu)
    .manage(AgentProxyState(proxy_port.clone(), proxy_child.clone()))
    .setup(move |app| {
      // Spawn the agent proxy sidecar automatically
      // Production: use bundled binary or .mjs fallback
      // Dev: skip (use `npm run serve`)
      let is_dev = cfg!(debug_assertions) || std::env::var("TAURI_DEV").is_ok();

      if !is_dev {
        let resource_dir = app.path_resolver().resource_dir().expect("resource dir");
        let mut sidecar_path = resource_dir.join("agent-proxy");

        // Try the sidecar binary first (for production builds)
        let is_windows = cfg!(windows);
        if is_windows {
          sidecar_path = sidecar_path.with_extension("exe");
        }

        let mut cmd = if sidecar_path.exists() {
          Command::new(sidecar_path)
        } else {
          // Fallback: run with node + the .mjs (if bundled as resource)
          let script_path = resource_dir.join("agent-proxy.mjs");
          let mut node_cmd = Command::new("node");
          node_cmd.args([script_path.to_string_lossy().to_string()]);
          node_cmd
        };

        let (mut rx, child) = cmd
          .spawn()
          .expect("Failed to spawn agent-proxy sidecar");

        // Store child handle for robust kill on quit (RECOMMENDATIONS sidecar management)
        {
          let mut guard = proxy_child_clone.lock().unwrap();
          *guard = Some(child);
        }

        let port_state = proxy_port_clone.clone();
        tauri::async_runtime::spawn(async move {
          while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(line) = event {
              let line = String::from_utf8_lossy(&line);
              if let Some(port_str) = line.strip_prefix("AGENT_PROXY_PORT=") {
                if let Ok(port) = port_str.trim().parse::<u16>() {
                  let mut guard = port_state.lock().unwrap();
                  *guard = Some(port);
                  println!("[dabasemint] Agent proxy sidecar running on port {}", port);
                }
              }
            }
          }
        });

        // Also poll the port file written by agent-proxy (robust discovery, no extra crates)
        let port_state2 = proxy_port_clone.clone();
        tauri::async_runtime::spawn(async move {
          use std::thread;
          use std::time::Duration;
          use std::env;
          use std::path::PathBuf;
          let home = env::var("HOME").or_else(|_| env::var("USERPROFILE")).unwrap_or_default();
          let port_file = PathBuf::from(home).join(".dabasemint").join("agent-proxy-port.json");
          for _ in 0..30 {
            if let Ok(content) = std::fs::read_to_string(&port_file) {
              if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(p) = parsed.get("port").and_then(|v| v.as_u64()) {
                  let mut g = port_state2.lock().unwrap();
                  if g.is_none() { *g = Some(p as u16); }
                  break;
                }
              }
            }
            thread::sleep(Duration::from_millis(200));
          }
        });
      } else {
        println!("[dabasemint] Dev mode - using external `npm run serve` for agent proxy");
      }

      Ok(())
    })
    .on_menu_event(|event| {
      match event.menu_item_id() {
        "quit" => {
          kill_agent_proxy(event.window().app_handle());
          std::process::exit(0);
        }
        "close" => {
          kill_agent_proxy(event.window().app_handle());
          event.window().close().unwrap();
        }
        _ => {}
      }
    })
    .invoke_handler(tauri::generate_handler![
      pick_folder_native,
      read_toolchest_native,
      read_file_native,
      get_agent_proxy_port
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

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
    "name": base.file_name().unwrap_or_default().to_string_lossy(),
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
      if name.chars().take(3).collect::<String>().chars().all(|c| c.is_ascii_digit()) && name.contains('-') {
        modules.push(name);
      }
    }
  }
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

#[tauri::command]
async fn get_agent_proxy_port(state: State<'_, AgentProxyState>) -> Result<Option<u16>, String> {
  let guard = state.0.lock().unwrap();
  Ok(*guard)
}

/// Kill the agent proxy sidecar (by stored child handle or port-file pid).
/// Called on quit/close for clean shutdown (RECOMMENDATIONS.md).
fn kill_agent_proxy(app: tauri::AppHandle) {
  if let Some(state) = app.try_state::<AgentProxyState>() {
    // Kill via stored Child handle if present
    if let Ok(mut guard) = state.1.lock() {
      if let Some(child) = guard.take() {
        let _ = child.kill();
        println!("[dabasemint] Killed agent-proxy child");
      }
    }
    // Also try port file pid as fallback
    if let Ok(mut port_guard) = state.0.lock() {
      if let Some(port) = *port_guard {
        // Best effort: on Unix send SIGTERM to known pid if we had it, here just clear
        *port_guard = None;
      }
    }
  }
}