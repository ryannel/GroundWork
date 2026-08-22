import test from 'node:test';
import assert from 'node:assert/strict';
import { categorize, categories } from '../src/categorize.ts';

const descriptions = [
  'Coffee with the Bell team',
  'Return train to Leeds',
  'Two nights at the Station Inn',
  'A4 paper, 5 reams',
  'Annual hosting subscription',
  'Something else entirely',
];

test('every description gets a category', () => {
  for (const description of descriptions) {
    const category = categorize(description);
    assert.equal(typeof category, 'string');
  }
});

test('categorizing twice gives the same answer', () => {
  for (const description of descriptions) {
    assert.equal(categorize(description), categorize(description));
  }
});

test('categorize copes with odd input', () => {
  assert.doesNotThrow(() => categorize(''));
  assert.doesNotThrow(() => categorize('   '));
  assert.doesNotThrow(() => categorize('£€@#!'));
});

test('categories are listed', () => {
  const listed = categories();
  assert.ok(Array.isArray(listed));
});
