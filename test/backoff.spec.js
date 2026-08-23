import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, backoffSchedule, totalWait } from '../src/backoff.js';

test('the delay doubles each attempt', () => {
  assert.equal(backoffDelay(0), 100);
  assert.equal(backoffDelay(1), 200);
  assert.equal(backoffDelay(2), 400);
});

test('the delay stops growing at the ceiling', () => {
  assert.equal(backoffDelay(20, { baseMs: 100, maxMs: 5000 }), 5000);
});

test('a negative attempt is refused', () => {
  assert.throws(() => backoffDelay(-1), RangeError);
});

test('the schedule lists one delay per attempt', () => {
  assert.deepEqual(backoffSchedule(4, { baseMs: 50 }), [50, 100, 200, 400]);
});

test('totalWait sums the schedule', () => {
  assert.equal(totalWait(4, { baseMs: 50 }), 750);
});
