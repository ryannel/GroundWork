import test from 'node:test';
import assert from 'node:assert/strict';
import { greets } from '../src/beta.mjs';

test('greets', () => {
  assert.equal(greets('alpha'), 'hello alpha');
});

// Subtests, the node way. The adapter reports only the top-level test, and
// D30 folds anything nested into it.
test('greets a table', async (t) => {
  await t.test('one name', () => {
    assert.equal(greets('one'), 'hello one');
  });
  await t.test('another name', () => {
    assert.equal(greets('two'), 'hello two');
  });
});
