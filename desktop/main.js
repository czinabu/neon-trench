"use strict";
// Neon Trench desktop: an Electron window that loads the web game's own index.html from disk.
// The game files are not copied by hand: electron-builder packs index.html, css/, js/ and vendor/
// from the repo root into the app (see "build.files" in desktop/package.json), so the exe always
// matches the web build. During `npm start` they are loaded straight from the repo root.

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Synthesized audio starts without waiting for a click, like a native game.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// A game window keeps drawing and playing sound even when Windows thinks it's covered or in the
// background (overlays like Discord or Steam can make Windows report the window as hidden).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// A plain-text log next to the save data (%APPDATA%\Neon Trench\neon-trench.log on Windows), with
// the page's errors, the graphics card in use and update checks, to send along with a bug report.
let logFile = null;
function log(...parts){
  try {
    if (!logFile) logFile = path.join(app.getPath('userData'), 'neon-trench.log');
    fs.appendFileSync(logFile, new Date().toISOString() + ' ' + parts.join(' ') + '\n');
  } catch (e){}
}

// Packed builds keep the game in <app>/game; a dev run uses the repo root next to this folder.
function gameIndex(){
  const packed = path.join(__dirname, 'game', 'index.html');
  return fs.existsSync(packed) ? packed : path.join(__dirname, '..', 'index.html');
}

// One window only: opening the exe again focuses the running game (and its save).
if (!app.requestSingleInstanceLock()) app.quit();

// packed builds carry the release version; a dev run (`npm start`) shows the repo's own
function gameVersion(){
  if (app.isPackaged) return app.getVersion();
  try { return require('../package.json').version; } catch (e){ return app.getVersion(); }
}

let win = null;
function createWindow(){
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#05050c',
    title: 'Neon Trench',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,   // keep the sim and audio running if the window loses focus
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: ['--nt-version=' + gameVersion()],   // the title screen's version label (preload.js)
    },
  });
  win.maximize();

  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') log('[page ' + e.level + ']', e.message, e.sourceId ? '(' + path.basename(e.sourceId) + ':' + e.lineNumber + ')' : '');
  });
  win.webContents.on('render-process-gone', (e, d) => log('[crash] page', d.reason));
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`(() => {
      const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl');
      const d = g && g.getExtension('WEBGL_debug_renderer_info');
      return 'webgl ' + (g ? (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'on') : 'UNAVAILABLE');
    })()`).then(r => log('[gpu]', r)).catch(() => {});
  });

  // F11 toggles fullscreen too (the game's own Fullscreen toggle and Settings row also work).
  // Ctrl+Shift+I opens DevTools for debugging.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11'){ win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (input.control && input.shift && input.key.toLowerCase() === 'i'){ win.webContents.toggleDevTools(); e.preventDefault(); }
  });

  // Links to web pages open in the normal browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')){ e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });

  win.loadFile(gameIndex());
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

// Auto-update (installed copies only). Each merge to main that changes the game publishes a GitHub
// release (.github/workflows/windows-exe.yml). The installed app checks on launch and every
// 30 minutes, downloads a newer release in the background, shows a small note in the game, and
// installs it the next time the game is closed. The portable exe can't replace itself, so it skips this.
const UPDATE_EVERY = 30 * 60 * 1000;
function setupUpdates(){
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e){ return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', e => log('[update] check failed:', e && e.message));   // offline is fine
  autoUpdater.on('update-available', info => log('[update] downloading', info.version));
  autoUpdater.on('update-downloaded', info => { log('[update] ready', info.version); showUpdateNote(info.version); });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, UPDATE_EVERY);
}
// a small corner note drawn into the page; it never pauses or covers the game and fades on its own
function showUpdateNote(version){
  if (!win) return;
  const text = 'Update ' + version + ' downloaded. It installs when you close the game.';
  win.webContents.executeJavaScript(`(() => {
    let n = document.getElementById('desktopUpdateNote');
    if (!n){ n = document.createElement('div'); n.id = 'desktopUpdateNote';
      n.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;padding:8px 12px;font:12px monospace;color:#00f0ff;background:rgba(5,5,12,.85);border:1px solid rgba(0,240,255,.5);pointer-events:none;transition:opacity 1s';
      document.body.appendChild(n); }
    n.textContent = ${JSON.stringify(text)}; n.style.opacity = '1';
    clearTimeout(n._t); n._t = setTimeout(() => { n.style.opacity = '0'; }, 12000);
  })()`).catch(() => {});
}

ipcMain.on('desktop:quit', () => app.quit());   // the game's Exit buttons (js/desktop.js)
app.on('child-process-gone', (e, d) => log('[crash]', d.type, d.reason));

app.whenReady().then(() => {
  log('--- Neon Trench', app.getVersion(), 'Electron', process.versions.electron, process.platform, process.arch,
      app.isPackaged ? (process.env.PORTABLE_EXECUTABLE_FILE ? 'portable' : 'installed') : 'dev');
  log('[gpu] status', JSON.stringify(app.getGPUFeatureStatus()));
  Menu.setApplicationMenu(null);
  createWindow();
  setupUpdates();
});
app.on('window-all-closed', () => app.quit());
