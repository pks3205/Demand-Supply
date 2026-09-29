const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../renderer/timer-logic.js');

const HOUR = 3600000;

test('exact hour boundary, offset 0: dials show the full interval', () => {
  const rows = L.computeAll(HOUR * 100000, 0); // exactly on the hour
  assert.equal(rows[2].label, '60:00'); // 1H: 3600s left
  assert.equal(rows[1].label, '5:00');  // 5M: 300s left
  assert.equal(rows[0].label, '1:00');  // 1M: 60s left
  rows.forEach((r) => assert.ok(r.progress > 0.999 && r.progress <= 1));
});

test('mid-candle values match true seconds left', () => {
  const base = HOUR * 100000;
  const rows = L.computeAll(base + 47000, 0); // 47s into the minute
  assert.equal(rows[0].label, '0:13'); // 13s truly left
  assert.equal(rows[1].label, '4:13');
  assert.equal(rows[2].label, '59:13');
  assert.ok(Math.abs(rows[0].progress - 13000 / 60000) < 1e-9);
});

test('last second before close shows 0:01 (never fast)', () => {
  const base = HOUR * 100000;
  const rows = L.computeAll(base + 59500, 0); // 0.5s left
  assert.equal(rows[0].label, '0:01');
});

test('offset shifts boundaries: broker 30m behind local', () => {
  const local = HOUR * 100000 + 30 * 60000; // local half past the hour
  const rows = L.computeAll(local, -1800);   // broker = local - 30m = exact hour
  assert.equal(rows[2].label, '60:00');
  assert.equal(rows[0].label, '1:00');
});

test('parseTimeInput: broker 2.5h behind local', () => {
  const local = new Date(2026, 0, 5, 14, 32, 10).getTime();
  assert.equal(L.parseTimeInput('12:02:10', local), -9000);
});

test('parseTimeInput wraps across midnight', () => {
  const local = new Date(2026, 0, 5, 0, 10, 0).getTime();
  assert.equal(L.parseTimeInput('23:40:00', local), -1800);
});

test('parseTimeInput rejects garbage', () => {
  assert.equal(L.parseTimeInput('hello', Date.now()), null);
  assert.equal(L.parseTimeInput('', Date.now()), null);
});

test('fmt pads seconds only', () => {
  assert.equal(L.fmt(47), '0:47');
  assert.equal(L.fmt(1915), '31:55');
  assert.equal(L.fmt(3599), '59:59');
});
