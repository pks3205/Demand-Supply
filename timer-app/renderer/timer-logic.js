/*
 * timer-logic.js — pure countdown math for candle-close timers.
 * No DOM, no clock side effects beyond what the caller passes in,
 * so the exact same file runs in the Electron renderer, the browser
 * fallback, and Node unit tests.
 *
 * Candle boundaries (1m / 5m / 1h) fall on exact epoch multiples in the
 * chart's clock.  Brokers run on a shifted server clock, so we keep an
 * `offsetSec` (broker minus local) and derive every countdown from the
 * real clock + offset: drift-free, forever synced after one sync.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TimerLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INTERVALS = [
    { key: '1M', sec: 60 },
    { key: '5M', sec: 300 },
    { key: '1H', sec: 3600 }
  ];

  function serverNowMs(localMs, offsetSec) {
    return localMs + (offsetSec || 0) * 1000;
  }

  // ms left until the next epoch-aligned boundary of `intervalSec`,
  // measured in the (offset) chart clock.  At the exact boundary the
  // full interval is returned.
  function remainingMs(nowMs, intervalSec) {
    var iv = intervalSec * 1000;
    var r = iv - (nowMs % iv);
    return r <= 0 ? iv : r;
  }

  // Whole seconds shown on the dial: 59:59 style (full interval shows
  // interval-1, last second before close shows 0:00).
  function secondsLeft(remainingMillis) {
    return Math.max(0, Math.ceil(remainingMillis / 1000) - 1);
  }

  // m:ss with unpadded minutes, padded seconds ("0:47", "31:55").
  function fmt(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function computeAll(localMs, offsetSec) {
    var now = serverNowMs(localMs, offsetSec);
    return INTERVALS.map(function (iv) {
      var r = remainingMs(now, iv.sec);
      var secs = secondsLeft(r);
      return {
        key: iv.key,
        sec: iv.sec,
        remainingMs: r,
        label: fmt(secs),
        progress: r / (iv.sec * 1000) // 1 = just reset, -> 0 as close approaches
      };
    });
  }

  // "HH:MM:SS" or "HH:MM" typed from the broker chart clock -> offset in
  // whole seconds (broker minus local).  Wraps across midnight sensibly
  // (within +/- 12h).  Returns null when unparseable.
  function parseTimeInput(str, localMs) {
    var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(str || '').trim());
    if (!m) return null;
    var target = new Date(localMs);
    target.setHours(+m[1], +m[2], m[3] !== undefined ? +m[3] : 0, 0);
    var diff = Math.round((target.getTime() - localMs) / 1000);
    if (diff > 12 * 3600) diff -= 24 * 3600;
    if (diff < -12 * 3600) diff += 24 * 3600;
    return diff;
  }

  function fmtClock(ms) {
    var d = new Date(ms);
    return (
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0')
    );
  }

  return {
    INTERVALS: INTERVALS,
    serverNowMs: serverNowMs,
    remainingMs: remainingMs,
    secondsLeft: secondsLeft,
    fmt: fmt,
    fmtClock: fmtClock,
    computeAll: computeAll,
    parseTimeInput: parseTimeInput
  };
});
