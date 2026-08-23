import test from 'node:test';
import assert from 'node:assert/strict';
import { addsUp, name } from '../src/alpha.mjs';

test('adds up', () => {
  assert.equal(addsUp(2, 2), 4);
});

// This test fails on purpose. The fixture pack needs one failing test, or an
// adapter that reported everything as passing would conform.
test('adds up wrong', () => {
  assert.equal(addsUp(2, 2), 5);
});

test('is named', () => {
  assert.equal(name(), 'alpha');
});
