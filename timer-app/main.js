// Gold Candle Timers — Electron main process.
// Small frameless transparent always-on-top widget (Size S: 250x84 strip
// inside a 280x114 window so the glow has room), pinned to the right side
// of the screen.  Settings mode grows the window downward.

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const BASE_W = 280;
const BASE_H = 114;
const SETTINGS_H = 356;
const MARGIN = 10;

const defaults = { offsetSec: 0, beep: false, top: true };
let cfg = Object.assign({}, defaults);

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function loadConfig() {
  try {
    cfg = Object.assign({}, defaults, JSON.parse(fs.readFileSync(configPath(), 'utf8')));
  } catch (e) {
    cfg = Object.assign({}, defaults);
  }
}
function saveConfig() {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) { /* first run, read-only fs, etc. */ }
}

// Right edge, upper third; top edge stays put when the window grows.
function positionFor(h) {
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    x: wa.x + wa.width - BASE_W - MARGIN,
    y: wa.y + Math.max(4, Math.round(wa.height * 0.25) - Math.round(BASE_H / 2))
  };
}

let win = null;

function createWindow() {
  const pos = positionFor(BASE_H);
  win = new BrowserWindow({
    width: BASE_W,
    height: BASE_H,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: !!cfg.top,
    skipTaskbar: false,
    show: false,
    title: 'Gold Candle Timers',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false // keep ticking while chart has focus
    }
  });
  win.setVisibleOnAllWorkspaces(true);
  if (cfg.top) win.setAlwaysOnTop(true, 'pop-up-menu');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Headless self-check hook: SCREENSHOT_OUT=/path.png electron .
  if (process.env.SCREENSHOT_OUT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.capturePage().then((img) => {
          try { fs.writeFileSync(process.env.SCREENSHOT_OUT, img.toPNG()); } catch (e) {}
          app.quit();
        });
      }, 1500);
    });
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) win.show(); });
  app.whenReady().then(() => {
    loadConfig();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

ipcMain.handle('get-config', () => cfg);

ipcMain.on('set-config', (e, patch) => {
  if (!patch || typeof patch !== 'object') return;
  if (typeof patch.offsetSec === 'number') cfg.offsetSec = Math.round(patch.offsetSec);
  if (typeof patch.beep === 'boolean') cfg.beep = patch.beep;
  if (typeof patch.top === 'boolean') {
    cfg.top = patch.top;
    if (win) {
      win.setAlwaysOnTop(cfg.top, 'pop-up-menu');
      win.setVisibleOnAllWorkspaces(cfg.top);
    }
  }
  saveConfig();
});

ipcMain.on('set-mode', (e, mode) => {
  if (!win) return;
  const h = mode === 'settings' ? SETTINGS_H : BASE_H;
  const pos = positionFor(h);
  win.setSize(BASE_W, h);
  win.setPosition(pos.x, pos.y);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
