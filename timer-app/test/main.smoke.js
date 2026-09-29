// Smoke test: executes main.js against a stubbed electron framework.
// Verifies window options, IPC wiring, sizing and config handling.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const state = { windows: [], ipcOn: {}, ipcHandle: {} };

class FakeBrowserWindow {
  constructor(opts) { this.opts = opts; state.windows.push(this); }
  setVisibleOnAllWorkspaces() {}
  setAlwaysOnTop(v) { this.opts.alwaysOnTop = v; }
  loadFile(p) { this.loaded = p; }
  once(ev, cb) { if (ev === 'ready-to-show') this._show = cb; }
  show() { this.visible = true; if (this._show) this._show(); }
  setSize(w, h) { this.size = [w, h]; }
  setPosition(x, y) { this.pos = [x, y]; }
}

const fakeElectron = {
  app: {
    requestSingleInstanceLock: () => true,
    on() {},
    whenReady: () => Promise.resolve(),
    getPath: () => os.tmpdir(),
    quit() { state.quit = true; }
  },
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    handle: (ch, fn) => { state.ipcHandle[ch] = fn; },
    on: (ch, fn) => { state.ipcOn[ch] = fn; }
  },
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) }
};

const origLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === 'electron') return fakeElectron;
  return origLoad.call(this, request, ...args);
};
require('../main.js');

test('main.js creates the always-on-top transparent widget window', async () => {
  await new Promise((r) => setImmediate(r)); // let whenReady() resolve
  assert.equal(state.windows.length, 1);
  const w = state.windows[0];
  assert.equal(w.opts.transparent, true);
  assert.equal(w.opts.frame, false);
  assert.equal(w.opts.alwaysOnTop, true);
  assert.equal(w.opts.webPreferences.backgroundThrottling, false);
  assert.equal(w.opts.width, 280);
  assert.equal(w.opts.height, 114);
  assert.ok(w.loaded.endsWith(path.join('renderer', 'index.html')));
  // pinned to right edge of 1920x1080 work area
  assert.equal(w.opts.x, 1920 - 280 - 10);
});

test('set-mode IPC grows/shrinks the window, keeping right edge', async () => {
  const w = state.windows[0];
  state.ipcOn['set-mode'](null, 'settings');
  assert.deepEqual(w.size, [280, 356]);
  assert.equal(w.pos[0], 1630);
  state.ipcOn['set-mode'](null, 'widget');
  assert.deepEqual(w.size, [280, 114]);
});

test('set-config IPC stores offset and get-config returns it', async () => {
  state.ipcOn['set-config'](null, { offsetSec: -9000, beep: true });
  const cfg = await state.ipcHandle['get-config']();
  assert.equal(cfg.offsetSec, -9000);
  assert.equal(cfg.beep, true);
  assert.equal(cfg.top, true);
});
