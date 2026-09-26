'use strict';
// The only bridge between the page and the desktop shell. The page checks for
// `window.marsamNative` and falls back to browser behaviour when it is absent.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marsamNative', {
  platform: process.platform,
  version: () => ipcRenderer.invoke('app:version'),

  openFiles: (filterName) => ipcRenderer.invoke('file:open', { filterName }),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, text) => ipcRenderer.invoke('file:write', { path: filePath, text }),
  saveFile: (filename, data, filterName) => ipcRenderer.invoke('file:save', { filename, data, filterName }),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:show', filePath),
  askUnsaved: (options) => ipcRenderer.invoke('dialog:unsaved', options),

  copyText: (text) => ipcRenderer.invoke('clipboard:text', text),
  copyImage: (bytes) => ipcRenderer.invoke('clipboard:image', bytes),
  renderPdf: (options) => ipcRenderer.invoke('pdf:render', options),

  checkForUpdates: (manual) => ipcRenderer.invoke('update:check', manual),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (callback) => ipcRenderer.on('update:event', (_event, payload) => callback(payload)),

  onOpenFiles: (callback) => {
    ipcRenderer.on('open-files', (_event, files) => callback(files));
    ipcRenderer.send('renderer:ready');
  },
  onCloseRequest: (callback) => ipcRenderer.on('app:close-request', () => {
    ipcRenderer.send('app:close-ack');
    callback();
  }),
  confirmClose: () => ipcRenderer.send('app:close-ok'),
});
