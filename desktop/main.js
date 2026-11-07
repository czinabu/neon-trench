"use strict";
// Neon Trench desktop: an Electron window that loads the web game's own index.html from disk.
// The game files are not copied by hand: electron-builder packs index.html, css/, js/ and vendor/
// from the repo root into the app (see "build.files" in desktop/package.json), so the exe always
// matches the web build. During `npm start` they are loaded straight from the repo root.

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Synthesized audio starts without waiting for a click, like a native game.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Packed builds keep the game in <app>/game; a dev run uses the repo root next to this folder.
function gameIndex(){
  const packed = path.join(__dirname, 'game', 'index.html');
  return fs.existsSync(packed) ? packed : path.join(__dirname, '..', 'index.html');
}

// One window only: opening the exe again focuses the running game (and its save).
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function createWindow(){
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#05050c',
    title: 'Neon Trench',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,   // keep the sim and audio running if the window loses focus
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
