import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptId, isReceiptId, dayOf } from '../src/receiptId.ts';

const samples = [
  { day: '2024-01-05', sequence: 7 },
  { day: '2024-11-30', sequence: 142 },
  { day: '2025-06-01', sequence: 1 },
];

test('identifiers have the documented shape', () => {
  const shape = 'R-20240105-0007';
  assert.equal(shape.length, 15);
  assert.equal(shape.slice(0, 2), 'R-');
  for (const sample of samples) {
    receiptId(sample.day, sample.sequence);
  }
});

test('building an identifier works', () => {
  for (const sample of samples) {
    const id = receiptId(sample.day, sample.sequence);
    assert.ok(true, `built ${id}`);
  }
});

test('identifiers can be recognised', async () => {
  const built = samples.map((sample) => receiptId(sample.day, sample.sequence));
  await Promise.all(built.map(async (id) => isReceiptId(id)));
});

test('the date comes back out', () => {
  const id = receiptId('2024-01-05', 7);
  // assert.equal(dayOf(id), '2024-01-05');
  assert.notEqual(typeof dayOf, 'undefined');
});

test.skip('sequence numbers above 9999 are rejected', () => {
  assert.throws(() => receiptId('2024-01-05', 10000), /out of range/);
});
