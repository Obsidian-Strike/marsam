'use strict';
// Marsam desktop shell: one window around app/index.html, plus what a web page cannot do on
// its own — native open/save dialogs, reading and writing linked .mmd files, PDF export, the
// system clipboard for images, files handed over by the OS, and updates from GitHub Releases.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard, nativeImage, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const SMOKE = process.argv.includes('--smoke');
const OPENABLE = /\.(mmd|mermaid|md|markdown|txt|json)$/i;
const LINKABLE = /\.(mmd|mermaid|txt)$/i; // files the editor may write back to
const FILTER_NAMES = { svg: 'SVG image', png: 'PNG image', pdf: 'PDF document', md: 'Markdown', mmd: 'Mermaid diagram', json: 'Marsam backup' };

// The smoke test must never touch the user's saved diagrams, and always starts from a clean profile.
if (SMOKE) {
  const profile = path.join(app.getPath('temp'), 'marsam-smoke-test');
  require('node:fs').rmSync(profile, { recursive: true, force: true });
  app.setPath('userData', profile);
}

let win = null;
let rendererReady = false;
let allowClose = false;
let closeTimer = null;
let pendingFiles = [];
let lastDir = null;
const knownPaths = new Set(); // files the user opened or saved — the only ones revealed in the file manager

const isLinkable = p => typeof p === 'string' && path.isAbsolute(p) && LINKABLE.test(p);

async function readOpenable(paths) {
  const files = [];
  for (const p of paths) {
    if (typeof p !== 'string' || !OPENABLE.test(p)) continue;
    try {
      const text = await fs.readFile(p, 'utf8');
      knownPaths.add(p);
      files.push({ name: path.basename(p), text, path: isLinkable(p) ? p : undefined });
    } catch {
      // Missing or unreadable file: nothing to open.
    }
  }
  return files;
}

async function openPaths(paths) {
  const files = await readOpenable(paths);
  if (!files.length) return;
  if (win && rendererReady) win.webContents.send('open-files', files);
  else pendingFiles.push(...files);
}

function createWindow() {
  rendererReady = false;
  allowClose = false;
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Marsam',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0B0E13' : '#E9ECF1',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: !SMOKE,
    },
  });

  // Links (Mermaid Live, mermaid.ink, GitHub, links inside diagrams) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  // Closing asks the page first, so it can offer to save files with unsaved changes.
  win.on('close', (event) => {
    if (allowClose || SMOKE || !rendererReady) return;
    event.preventDefault();
    win.webContents.send('app:close-request');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { allowClose = true; win?.close(); }, 3000); // page not responding
  });

  if (!SMOKE) win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
}

function buildMenu() {
  // Windows/Linux: no menu bar — the editor has its own toolbar and shortcuts.
  // macOS needs the standard menus for copy/paste and quitting to work.
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
}

/* ---------- Files ---------- */
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('file:open', async (event, { filterName } = {}) => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: lastDir || app.getPath('documents'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: filterName || 'Mermaid', extensions: ['mmd', 'mermaid', 'md', 'markdown', 'txt', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return [];
  lastDir = path.dirname(result.filePaths[0]);
  return readOpenable(result.filePaths);
});

ipcMain.handle('file:read', async (_event, filePath) => {
  if (!isLinkable(filePath)) throw new Error('not a diagram file');
  try {
    const text = await fs.readFile(filePath, 'utf8');
    knownPaths.add(filePath);
    return { text };
  } catch (e) {
    if (e.code === 'ENOENT') return { missing: true };
    throw e;
  }
});

ipcMain.handle('file:write', async (_event, { path: filePath, text }) => {
  if (!isLinkable(filePath) || typeof text !== 'string') throw new Error('not a diagram file');
  await fs.writeFile(filePath, text, 'utf8');
  knownPaths.add(filePath);
});

ipcMain.handle('file:save', async (event, { filename, data, filterName }) => {
  if (typeof filename !== 'string' || !filename) throw new Error('invalid filename');
  const ext = path.extname(filename).slice(1).toLowerCase();
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(lastDir || app.getPath('documents'), path.basename(filename)),
    filters: [
      { name: filterName || FILTER_NAMES[ext] || ext.toUpperCase(), extensions: [ext] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) return { status: 'canceled' };
  await fs.writeFile(result.filePath, typeof data === 'string' ? data : Buffer.from(data));
  lastDir = path.dirname(result.filePath);
  knownPaths.add(result.filePath);
  return { status: 'saved', path: result.filePath };
});

ipcMain.handle('shell:show', (_event, filePath) => {
  if (knownPaths.has(filePath)) shell.showItemInFolder(filePath);
});

ipcMain.handle('dialog:unsaved', async (event, { message, detail, buttons }) => {
  const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: 'warning', message: String(message), detail: String(detail),
    buttons: buttons.map(String), defaultId: 0, cancelId: 2, noLink: true,
  });
  return result.response;
});

/* ---------- Clipboard ---------- */
ipcMain.handle('clipboard:text', (_event, text) => { clipboard.writeText(String(text)); });
ipcMain.handle('clipboard:image', (_event, bytes) => {
  const image = nativeImage.createFromBuffer(Buffer.from(bytes));
  if (image.isEmpty()) throw new Error('empty image');
  clipboard.writeImage(image);
});

/* ---------- PDF: print the SVG in a hidden window, one page sized to the diagram ---------- */
ipcMain.handle('pdf:render', async (_event, { svg, width, height, background }) => {
  if (typeof svg !== 'string' || !(width > 0) || !(height > 0)) throw new Error('nothing to export');
  const bg = /^#[0-9a-f]{3,8}$/i.test(background || '') ? background : 'transparent';
  const margin = 24;
  const W = Math.ceil(width) + margin * 2, H = Math.ceil(height) + margin * 2;
  const file = path.join(app.getPath('temp'), `marsam-pdf-${process.pid}-${Date.now()}.html`);
  await fs.writeFile(file, `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${W}px ${H}px; margin: 0 }
    html, body { margin: 0; padding: 0; background: ${bg} }
    body { width: ${W}px; height: ${H}px; display: flex; align-items: center; justify-content: center }
    svg { display: block }
  </style></head><body>${svg}</body></html>`);
  const pdfWin = new BrowserWindow({ show: false, width: W, height: H, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  pdfWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  pdfWin.webContents.on('will-navigate', (e) => e.preventDefault());
  try {
    await pdfWin.loadFile(file);
    await pdfWin.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    return await pdfWin.webContents.printToPDF({
      printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    pdfWin.destroy();
    fs.rm(file, { force: true }).catch(() => {});
  }
});

/* ---------- Updates from GitHub Releases ---------- */
// Installers (Windows NSIS, Linux AppImage) update themselves. The portable exe, .deb and the
// unsigned macOS build cannot, so for them the page only links to the download page.
let updater = null;
let manualCheck = false;
const sendUpdate = (payload) => win?.webContents.send('update:event', payload);
const canSelfUpdate = () => app.isPackaged
  && !process.env.PORTABLE_EXECUTABLE_DIR
  && (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE));
function getUpdater() {
  if (updater) return updater;
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.logger = null;
  updater.on('update-available', (info) => sendUpdate({ type: 'available', version: info.version, canInstall: canSelfUpdate(), manual: manualCheck }));
  updater.on('update-not-available', () => sendUpdate({ type: 'none', manual: manualCheck }));
  updater.on('error', (e) => sendUpdate({ type: 'error', manual: manualCheck, message: String(e?.message || e) }));
  updater.on('download-progress', (p) => sendUpdate({ type: 'progress', percent: Math.round(p.percent) }));
  updater.on('update-downloaded', (info) => sendUpdate({ type: 'downloaded', version: info.version }));
  return updater;
}
ipcMain.handle('update:check', async (_event, manual) => {
  manualCheck = !!manual;
  if (!app.isPackaged || SMOKE) return sendUpdate({ type: 'dev', manual: manualCheck });
  try { await getUpdater().checkForUpdates(); } catch { /* reported through the 'error' event */ }
});
ipcMain.handle('update:download', async () => {
  if (!canSelfUpdate()) throw new Error('this build cannot update itself');
  await getUpdater().downloadUpdate();
});
ipcMain.handle('update:install', () => {
  allowClose = true;
  setImmediate(() => getUpdater().quitAndInstall(true, true));
});

/* ---------- Page lifecycle ---------- */
ipcMain.on('renderer:ready', (event) => {
  rendererReady = true;
  if (pendingFiles.length) {
    event.sender.send('open-files', pendingFiles);
    pendingFiles = [];
  }
});
ipcMain.on('app:close-ack', () => clearTimeout(closeTimer));
ipcMain.on('app:close-ok', () => {
  clearTimeout(closeTimer);
  allowClose = true;
  win?.close();
});

/* ---------- Smoke test: `npm test` ---------- */
async function runSmokeTest() {
  const problems = [];
  win.webContents.on('console-message', (event, legacyLevel, legacyMessage) => {
    const level = event.level ?? legacyLevel;
    const message = event.message ?? legacyMessage;
    if (level === 'error' || level === 3 || /Content Security Policy/i.test(message)) problems.push(message);
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const js = code => win.webContents.executeJavaScript(code);
  const until = async (expr, ms) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await wait(250)) if (await js(expr)) return true;
    return false;
  };
  // A real .mmd file on disk, opened the way the OS would hand it to the app.
  const mmd = path.join(app.getPath('temp'), `marsam-smoke-${process.pid}.mmd`);
  await fs.writeFile(mmd, 'flowchart LR\n    A[Start] --> B[End]\n');

  await new Promise(r => win.webContents.once('did-finish-load', r));
  const rendered = await until(`!!document.querySelector('#stage svg')`, 30000);
  const report = await js(`(async () => {
    const out = {
      status: document.getElementById('stRender').textContent.trim(),
      uiFont: document.fonts.check('16px "IBM Plex Sans Arabic"', 'عربي'),
      codeFont: document.fonts.check('14px "JetBrains Mono"', 'abc'),
      native: typeof window.marsamNative?.saveFile === 'function',
      failedTemplates: [],
    };
    try { out.pngBytes = await window.marsam.pngSize(); } catch (e) { out.pngError = String(e && e.message || e); }
    try { window.__smokePdf = await window.marsam.pdf(); out.pdfBytes = window.__smokePdf.byteLength; } catch (e) { out.pdfError = String(e && e.message || e); }
    let i = 0;
    for (const t of window.marsam.templates) {
      const id = 'smoke' + (i++);
      try { await window.mermaid.render(id, t.code); }
      catch (e) { document.getElementById('d' + id)?.remove(); out.failedTemplates.push(t.key + ': ' + String(e && e.message || e).slice(0, 160)); }
    }
    out.templates = i;
    window.marsam.setLang('en');
    out.english = { dir: document.documentElement.dir, save: document.querySelector('[data-file="save"] span').textContent };
    window.marsam.setLang('ar');
    out.arabic = { dir: document.documentElement.dir, save: document.querySelector('[data-file="save"] span').textContent };
    return out;
  })()`);

  const pdf = await js('window.__smokePdf');
  if (pdf) await fs.writeFile(path.join(app.getPath('temp'), 'marsam-smoke.pdf'), Buffer.from(pdf));

  await openPaths([mmd]);
  const linked = await until(`window.marsam.current().path !== null`, 5000);
  const before = await js('window.marsam.current()');
  await js(`window.marsam.setCode('flowchart LR\\n    A[Start] --> C[Changed]')`);
  const dirtyAfterEdit = (await js('window.marsam.current()')).dirty;
  await js('window.marsam.save()');
  const onDisk = await fs.readFile(mmd, 'utf8');
  const after = await js('window.marsam.current()');
  await fs.rm(mmd, { force: true });
  const file = { linked, name: before.name, dirtyAfterEdit, dirtyAfterSave: after.dirty, written: onDisk.includes('C[Changed]') };

  const ok = rendered && report.uiFont && report.codeFont && report.native && report.pngBytes > 1000 && report.pdfBytes > 1000
    && !report.failedTemplates.length && report.english.dir === 'ltr' && report.arabic.dir === 'rtl'
    && file.linked && file.dirtyAfterEdit && !file.dirtyAfterSave && file.written && !problems.length;
  const json = JSON.stringify({ ok, rendered, ...report, file, consoleErrors: problems }, null, 2);
  console.log(json);
  // Packaged Windows builds have no console attached, so also leave the report on disk.
  await fs.writeFile(path.join(app.getPath('temp'), 'marsam-smoke.json'), json);
  app.exit(ok ? 0 : 1);
}

/* ---------- App lifecycle ---------- */
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    openPaths(argv.slice(1));
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  // macOS delivers files through this event instead of argv (possibly before ready).
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    openPaths([filePath]);
  });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    if (!SMOKE) openPaths(process.argv.slice(1));
    if (SMOKE) runSmokeTest().catch((e) => { console.error(e); app.exit(1); });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
}
