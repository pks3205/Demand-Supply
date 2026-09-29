/* Renderer: drives the three rings from the real clock + saved offset.
   Works in Electron (window.electronAPI) and plain browser (localStorage). */
(function () {
  'use strict';
  var L = window.TimerLogic;
  var api = window.electronAPI || null;
  var LS_KEY = 'gct-config';
  var cfg = { offsetSec: 0, beep: false, top: true };

  var C = 2 * Math.PI * 28; // ring circumference (r=28)

  var rings = {};
  ['1M', '5M', '1H'].forEach(function (k) {
    var el = document.getElementById('ring-' + k);
    rings[k] = {
      el: el,
      dig: el.querySelector('.dig'),
      fgc: el.querySelector('.fgc')
    };
  });

  var clkLocal = document.getElementById('clkLocal');
  var clkServer = document.getElementById('clkServer');
  var settings = document.getElementById('settings');
  var brokerTime = document.getElementById('brokerTime');
  var offVal = document.getElementById('offVal');
  var beepChk = document.getElementById('beep');
  var pin = document.getElementById('pin');

  function loadCfg(done) {
    if (api) {
      api.getConfig().then(function (c) { cfg = Object.assign(cfg, c || {}); done(); });
    } else {
      try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(LS_KEY) || '{}')); } catch (e) {}
      done();
    }
  }
  function saveCfg(patch) {
    Object.assign(cfg, patch);
    if (api) api.setConfig(patch);
    else localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  var actx = null;
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.06;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.15);
      o.stop(actx.currentTime + 0.16);
    } catch (e) {}
  }

  var prev = {};
  function tick() {
    var now = Date.now();
    L.computeAll(now, cfg.offsetSec).forEach(function (r) {
      var ring = rings[r.key];
      if (ring.dig.textContent !== r.label) ring.dig.textContent = r.label;
      ring.fgc.style.strokeDashoffset = (C * (1 - r.progress)).toFixed(2);
      if (prev[r.key] !== undefined && r.remainingMs > prev[r.key] + 500) {
        // candle just closed -> flash the ring
        ring.el.classList.add('flash');
        setTimeout(function () { ring.el.classList.remove('flash'); }, 800);
        if (cfg.beep) beep();
      }
      prev[r.key] = r.remainingMs;
    });
    clkLocal.textContent = L.fmtClock(now);
    clkServer.textContent = L.fmtClock(L.serverNowMs(now, cfg.offsetSec));
  }

  function updateOff() {
    var m = cfg.offsetSec / 60;
    offVal.textContent = String(Math.round(m * 10) / 10);
  }

  function openSettings(open) {
    settings.hidden = !open;
    if (api) api.setMode(open ? 'settings' : 'widget');
  }

  pin.addEventListener('click', function () {
    saveCfg({ top: !cfg.top });
    pin.classList.toggle('off', !cfg.top);
  });
  document.getElementById('gear').addEventListener('click', function () { openSettings(true); });
  document.getElementById('closeBtn').addEventListener('click', function () { openSettings(false); });

  document.getElementById('syncBtn').addEventListener('click', function () {
    var off = L.parseTimeInput(brokerTime.value, Date.now());
    if (off === null) {
      brokerTime.style.borderColor = '#ff6b6b';
      setTimeout(function () { brokerTime.style.borderColor = ''; }, 900);
      return;
    }
    saveCfg({ offsetSec: off });
    updateOff();
  });

  Array.prototype.forEach.call(document.querySelectorAll('.stepbtns button'), function (b) {
    b.addEventListener('click', function () {
      saveCfg({ offsetSec: cfg.offsetSec + parseInt(b.getAttribute('data-d'), 10) });
      updateOff();
    });
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    saveCfg({ offsetSec: 0 });
    updateOff();
  });

  beepChk.addEventListener('change', function () { saveCfg({ beep: beepChk.checked }); });

  loadCfg(function () {
    beepChk.checked = !!cfg.beep;
    pin.classList.toggle('off', !cfg.top);
    updateOff();
    tick();
    setInterval(tick, 200);
  });
})();
