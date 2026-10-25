// The only things the screen pages may ask the Electron shell to do.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('e46', {
  /** Close and reopen the whole app (both screens), e.g. after an update. */
  restartApp: () => ipcRenderer.send('e46:restart'),
});
