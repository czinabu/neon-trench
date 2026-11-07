"use strict";
// Gives the game page a small `desktopApp` object when it runs in the Windows app, so it can show
// desktop-only controls (the Exit buttons, js/desktop.js) and the installed version (the title
// screen's version label, which changes with each auto-update). The web build never has it.
const { contextBridge, ipcRenderer } = require('electron');
const verArg = process.argv.find(a => a.startsWith('--nt-version='));
contextBridge.exposeInMainWorld('desktopApp', {
  version: verArg ? verArg.slice('--nt-version='.length) : '',
  quit: () => ipcRenderer.send('desktop:quit'),
});
