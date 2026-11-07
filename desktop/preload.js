"use strict";
// Gives the game page a small `desktopApp` object when it runs in the Windows app, so it can show
// desktop-only controls (the Exit buttons, js/desktop.js). The web build never has it.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopApp', {
  quit: () => ipcRenderer.send('desktop:quit'),
});
