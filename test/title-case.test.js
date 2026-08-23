import test from 'node:test';
import assert from 'node:assert/strict';
import { titleCase, capitalize } from '../src/titleCase.js';

test('capitalize fixes the rest of the word too', () => {
  assert.equal(capitalize('hELLO'), 'Hello');
  assert.equal(capitalize(''), '');
});

test('titleCase capitalises ordinary words', () => {
  assert.equal(titleCase('hello world'), 'Hello World');
});

test('titleCase leaves small joining words lower case', () => {
  assert.equal(titleCase('the lord of the rings'), 'The Lord of the Rings');
  assert.equal(titleCase('a tale of two cities'), 'A Tale of Two Cities');
});

test('titleCase capitalises the first and last word even when small', () => {
  assert.equal(titleCase('the thing to look at'), 'The Thing to Look At');
});

test('titleCase collapses stray whitespace', () => {
  assert.equal(titleCase('  many   spaces here '), 'Many Spaces Here');
  assert.equal(titleCase('   '), '');
});
