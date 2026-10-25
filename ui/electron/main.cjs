// Electron shell: one window that shows the screen app.
//   electron .           normal window (for testing on the desk)
//   electron . --kiosk   fullscreen, no window frame (for the car)
// Ctrl+Shift+Q always quits, even in kiosk mode.
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

const kiosk = process.argv.includes('--kiosk');
const devUrl = process.env.E46_DEV_URL;

function createWindow() {
  const win = new BrowserWindow({
    // Same size as the Ibiza 8.25" screen; the app scales itself to any window.
    width: 1082,
    height: 480,
    kiosk,
    fullscreen: kiosk,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d10',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Parking beeps must play without a tap first.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'q') app.quit();
  });

  // Links never open inside the head unit.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  // The app only loads its own files, so it may use the camera (reverse
  // camera) and microphone without asking.
  const allowed = new Set(['media', 'mediaKeySystem']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
