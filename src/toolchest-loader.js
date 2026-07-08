/**
 * dabasemint — Real Toolchest Loader
 * 
 * Handles manual registration of actual toolchests from disk using
 * the File System Access API (modern browsers) or fallback.
 * 
 * Parses:
 *  - .forge-state.md (key findings, modules)
 *  - README.md (summary)
 *  - Numbered module folders (00-shared, 01-*, etc.)
 * 
 * Computes richer health, extracts contracts hints, etc.
 */

export async function registerToolchestFromDisk(preferredName = null) {
  // Prefer native Tauri dialog + FS when running in Tauri
  if (window.__TAURI__ && window.__TAURI__.invoke) {
    try {
      const selectedPath = await window.__TAURI__.invoke('pick_folder_native');
      if (!selectedPath) return null;

      const nativeData = await window.__TAURI__.invoke('read_toolchest_native', { path: selectedPath });

      const toolchest = {
        id: nativeData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: nativeData.name,
        path: selectedPath,
        sourceType: detectSourceType(nativeData.name),
        modules: (nativeData.modules || []).map(name => ({
          name,
          role: 'Module from toolchest',
          loc: '?',
          type: name.includes('shared') ? 'shared' : 'module'
        })),
        readme: nativeData.readme_preview || '',
        forgeState: {},
        contracts: nativeData.contracts || false,
        addedAt: Date.now(),
        _nativePath: selectedPath,           // Tauri can read this directly
        hasForgeState: nativeData.has_forge_state
      };

      if (nativeData.forge_state_preview) {
        // lightweight parse
        toolchest.forgeState = { raw_preview: nativeData.forge_state_preview };
      }

      return toolchest;
    } catch (err) {
      console.warn('Tauri native load failed, falling back to browser API', err);
    }
  }

  if (!window.showDirectoryPicker) {
    alert("Your browser doesn't fully support the File System Access API (needed for real folder loading).\nUse Chrome, Edge, or Arc for the best experience. Manual registration is still available as fallback.");
    return null;
  }

  try {
    const options = preferredName 
      ? { id: 'dabasemint-toolchest-' + preferredName, mode: 'read' }
      : { id: 'dabasemint-toolchest', mode: 'read' };

    const dirHandle = await window.showDirectoryPicker(options);

    const name = dirHandle.name;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Basic validation
    let hasForgeState = false;
    let hasModules = false;
    try {
      await dirHandle.getFileHandle('.forge-state.md');
      hasForgeState = true;
    } catch {}

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory' && /^\d{2}-/.test(entry.name)) {
        hasModules = true;
        break;
      }
    }

    if (!hasModules) {
      const proceed = confirm(`Folder "${name}" doesn't look like a typical /forge toolchest (no numbered module folders found). Continue anyway?`);
      if (!proceed) return null;
    }

    const toolchest = {
      id,
      name,
      path: `/${name}`,
      sourceType: detectSourceType(name),
      modules: [],
      readme: '',
      forgeState: {},
      contracts: false,
      addedAt: Date.now(),
      _dirHandle: dirHandle,
      hasForgeState
    };

    // Parse .forge-state.md
    try {
      const stateHandle = await dirHandle.getFileHandle('.forge-state.md');
      const file = await stateHandle.getFile();
      const content = await file.text();
      toolchest.forgeState = parseForgeState(content);
    } catch (e) {
      console.warn('Could not read .forge-state.md:', e.message);
    }

    // Parse README.md
    try {
      const readmeHandle = await dirHandle.getFileHandle('README.md');
      const file = await readmeHandle.getFile();
      const content = await file.text();
      toolchest.readme = content.slice(0, 1200);
    } catch {}

    // Discover numbered modules
    toolchest.modules = await discoverModules(dirHandle);

    // Detect contracts
    toolchest.contracts = await hasContracts(dirHandle);

    // Improve source type if possible
    if (toolchest.forgeState?.target?.includes('github')) {
      toolchest.sourceType = 'oss-repo';
    } else if (toolchest.forgeState?.target?.includes('pages.dev') || toolchest.forgeState?.js_bytes) {
      toolchest.sourceType = 'production-web';
    }

    return toolchest;

  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Toolchest registration failed:', err);
      alert('Failed to read folder. Make sure you grant permission and that the folder contains a /forge toolchest.');
    }
    return null;
  }
}

function detectSourceType(name) {
  if (name.includes('page-agent')) return 'oss-repo';
  if (name.includes('captions') || name.includes('site')) return 'production-web';
  if (name.includes('glaze') || name.includes('app')) return 'native-binary';
  return 'unknown';
}

async function discoverModules(dirHandle) {
  const modules = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory' && /^\d{2}-/.test(entry.name)) {
      let loc = '?';
      let hasReadme = false;
      let hasContracts = false;
      let role = 'Module from toolchest';
      try {
        const readmeHandle = await entry.getFileHandle('README.md', { create: false });
        const f = await readmeHandle.getFile();
        loc = Math.round(f.size / 10) || '?';
        hasReadme = true;

        // Try to extract a better role from the first lines of README
        try {
          const text = await f.text();
          const firstLines = text.split('\n').slice(0, 5).join(' ');
          const match = firstLines.match(/(?:^|\n)([A-Z][^.!?]{20,80})/);
          if (match) role = match[1].trim().slice(0, 70);
        } catch {}

        // Check for contracts inside module if it's the shared one
        if (entry.name === '00-shared') {
          try {
            await entry.getFileHandle('contracts.md');
            hasContracts = true;
          } catch {}
        }
      } catch {}
      modules.push({
        name: entry.name,
        role,
        loc: String(loc),
        type: entry.name.includes('shared') ? 'shared' : 'module',
        hasReadme,
        hasContracts
      });
    }
  }
  return modules.sort((a, b) => a.name.localeCompare(b.name));
}

async function hasContracts(dirHandle) {
  try {
    await dirHandle.getFileHandle('00-shared/contracts.md');
    return true;
  } catch {
    try {
      const shared = await dirHandle.getDirectoryHandle('00-shared');
      for await (const f of shared.values()) {
        if (f.name.toLowerCase().includes('contract')) return true;
      }
    } catch {}
  }
  return false;
}

function parseForgeState(content) {
  const data = {};
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('target:')) data.target = line.split(':')[1]?.trim();
    if (line.includes('modules:')) {
      const match = line.match(/modules:\s*(\d+|\[.*\])/);
      if (match) data.modules = match[1];
    }
    if (line.includes('js_bytes')) data.js_bytes = line.split(':')[1]?.trim();
  }
  return data;
}

export async function refreshToolchestFromDisk(toolchest) {
  // Tauri native refresh (preferred when available)
  if (window.__TAURI__ && window.__TAURI__.invoke && toolchest._nativePath) {
    try {
      const nativeData = await window.__TAURI__.invoke('read_toolchest_native', { path: toolchest._nativePath });
      toolchest.modules = (nativeData.modules || []).map(name => ({
        name,
        role: 'Module from toolchest',
        loc: '?',
        type: name.includes('shared') ? 'shared' : 'module'
      }));
      if (nativeData.readme_preview) toolchest.readme = nativeData.readme_preview;
      toolchest.contracts = nativeData.contracts || false;
      toolchest.hasForgeState = nativeData.has_forge_state;
      return toolchest;
    } catch (e) {
      console.warn('Tauri native refresh failed', e);
    }
  }

  if (!toolchest._dirHandle) {
    throw new Error('No directory handle stored. Re-register the toolchest.');
  }
  const dirHandle = toolchest._dirHandle;
  toolchest.modules = await discoverModules(dirHandle);
  try {
    const stateHandle = await dirHandle.getFileHandle('.forge-state.md');
    const content = await (await stateHandle.getFile()).text();
    toolchest.forgeState = parseForgeState(content);
  } catch {}
  try {
    const readmeHandle = await dirHandle.getFileHandle('README.md');
    const file = await readmeHandle.getFile();
    toolchest.readme = (await file.text()).slice(0, 1200);
  } catch {}
  toolchest.contracts = await hasContracts(dirHandle);
  return toolchest;
}
