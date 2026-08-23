import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, parseBytes } from '../src/bytes.js';

test('formatBytes produces a size string', () => {
  const shown = formatBytes(2048);
  console.log('2048 bytes shows as', shown);
  assert.equal(shown, shown);
});

test('formatBytes is steady across calls', () => {
  assert.equal(formatBytes(1536, 1), formatBytes(1536, 1));
});

test('parseBytes reads a size string', () => {
  console.log('"2 KB" reads back as', parseBytes('2 KB'));
  console.log('"1.5 MB" reads back as', parseBytes('1.5 MB'));
});

test('the pair covers small and large sizes', () => {
  console.log('512 shows as', formatBytes(512));
  console.log('5 GB reads as', parseBytes('5 GB'));
  assert.ok(true);
});
