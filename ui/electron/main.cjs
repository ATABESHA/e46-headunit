// Electron shell: the head unit and the instrument cluster, each in its own window.
//
//   electron .           normal windows (for testing on the desk)
//   electron . --kiosk   fullscreen on their screens (for the car)
//
// With two or more screens, the cluster opens on its own screen by itself.
// Keyboard (works in every window):
//   Ctrl+Shift+Q   quit
//   Ctrl+Shift+C   show / hide the cluster window (handy with one screen)
//   Ctrl+Shift+1   move the head unit to the next screen
//   Ctrl+Shift+2   move the cluster to the next screen
// The chosen screens are remembered.
const { app, BrowserWindow, ipcMain, session, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Draw with the graphics chip wherever possible (effects, needles, video).
app.commandLine.appendSwitch('enable-gpu-rasterization');

const kiosk = process.argv.includes('--kiosk');
const devUrl = process.env.E46_DEV_URL;

const windows = { headunit: null, cluster: null };
const SIZES = { headunit: { width: 1082, height: 480 }, cluster: { width: 1920, height: 720 } };
const PAGES = { headunit: 'index.html', cluster: 'cluster.html' };

// ---- Which window goes on which screen ----

const prefsFile = () => path.join(app.getPath('userData'), 'displays.json');
function loadPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsFile(), 'utf8'));
  } catch {
    return {};
  }
}
function savePrefs(prefs) {
  try {
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2));
  } catch {
    // Not remembered; still works for now.
  }
}

function displayFor(role) {
  const all = screen.getAllDisplays();
  const prefs = loadPrefs();
  const head = all.find((d) => d.id === prefs.headunit) ?? screen.getPrimaryDisplay();
  if (role === 'headunit') return head;
  return all.find((d) => d.id === prefs.cluster && d.id !== head.id) ?? all.find((d) => d.id !== head.id) ?? null;
}

function placeOn(win, display, role) {
  const fullscreen = kiosk && display;
  if (win.isKiosk()) win.setKiosk(false);
  if (win.isFullScreen()) win.setFullScreen(false);
  if (display) {
    const { x, y, width, height } = display.workArea;
    const size = SIZES[role];
    const w = Math.min(size.width, width);
    const h = Math.min(size.height, height);
    win.setBounds({ x: x + Math.round((width - w) / 2), y: y + Math.round((height - h) / 2), width: w, height: h });
  }
  if (fullscreen) win.setKiosk(true);
}

// ---- Windows ----

function onKeys(event, input) {
  if (!(input.control && input.shift) || input.type !== 'keyDown') return;
  const key = input.key.toLowerCase();
  if (key === 'q') app.quit();
  else if (key === 'c') toggleCluster();
  else if (key === '1' || key === '!') moveToNextScreen('headunit');
  else if (key === '2' || key === '@') moveToNextScreen('cluster');
  else return;
  event.preventDefault();
}

function createWindow(role, display) {
  const win = new BrowserWindow({
    ...SIZES[role],
    title: role === 'cluster' ? 'E46 Cluster' : 'E46 Head Unit',
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Parking beeps must play without a tap first.
      autoplayPolicy: 'no-user-gesture-required',
      // Keep the needles smooth even when the window is behind another one.
      backgroundThrottling: false,
    },
  });
  placeOn(win, display, role);
  win.once('ready-to-show', () => win.show());
  win.webContents.on('before-input-event', onKeys);
  // Links never open inside the app.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => {
    windows[role] = null;
    if (role === 'headunit') app.quit();
  });

  if (devUrl) win.loadURL(new URL(PAGES[role], devUrl.endsWith('/') ? devUrl : `${devUrl}/`).href);
  else win.loadFile(path.join(__dirname, '..', 'dist', PAGES[role]));
  windows[role] = win;
  return win;
}

function openCluster() {
  if (windows.cluster) return;
  createWindow('cluster', displayFor('cluster'));
}

function toggleCluster() {
  if (windows.cluster) windows.cluster.close();
  else openCluster();
}

function moveToNextScreen(role) {
  const win = windows[role];
  if (!win) return;
  const all = screen.getAllDisplays();
  if (all.length < 2) return;
  const current = screen.getDisplayMatching(win.getBounds());
  const next = all[(all.findIndex((d) => d.id === current.id) + 1) % all.length];
  const prefs = loadPrefs();
  const other = role === 'headunit' ? 'cluster' : 'headunit';
  // If the other window is on that screen, swap them.
  if (windows[other] && screen.getDisplayMatching(windows[other].getBounds()).id === next.id) {
    placeOn(windows[other], current, other);
    prefs[other] = current.id;
  }
  placeOn(win, next, role);
  prefs[role] = next.id;
  savePrefs(prefs);
}

// Restart the whole app (after an update). Starts again with the same options (--kiosk …).
ipcMain.on('e46:restart', () => {
  app.relaunch();
  app.exit(0);
});

app.whenReady().then(() => {
  // The app only loads its own files, so it may use the camera (reverse
  // camera) and microphone without asking.
  const allowed = new Set(['media', 'mediaKeySystem']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  createWindow('headunit', displayFor('headunit'));
  if (screen.getAllDisplays().length > 1 || process.argv.includes('--cluster')) openCluster();

  // Screens plugged in or out while running.
  screen.on('display-added', () => openCluster());
  screen.on('display-removed', () => {
    if (windows.cluster && screen.getAllDisplays().length < 2 && !process.argv.includes('--cluster')) windows.cluster.close();
  });
});
app.on('window-all-closed', () => app.quit());
