import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, formatQuery } from '../src/query.js';

test('parseQuery reads plain pairs', () => {
  assert.deepEqual(parseQuery('a=1&b=2'), { a: '1', b: '2' });
});

test('parseQuery tolerates a leading question mark and empty input', () => {
  assert.deepEqual(parseQuery('?a=1'), { a: '1' });
  assert.deepEqual(parseQuery(''), {});
  assert.deepEqual(parseQuery('?'), {});
});

test('parseQuery decodes escapes and plus signs', () => {
  assert.deepEqual(parseQuery('q=two+words&r=a%26b'), { q: 'two words', r: 'a&b' });
});

test('parseQuery collects repeated keys into an array', () => {
  assert.deepEqual(parseQuery('tag=x&tag=y&tag=z'), { tag: ['x', 'y', 'z'] });
});

test('parseQuery gives a bare key an empty value', () => {
  assert.deepEqual(parseQuery('flag'), { flag: '' });
});

test('formatQuery writes pairs and escapes them', () => {
  assert.equal(formatQuery({ a: 1, b: 'two words' }), 'a=1&b=two%20words');
});

test('formatQuery repeats the key for arrays and skips empty values', () => {
  assert.equal(formatQuery({ tag: ['x', 'y'], skip: null, gone: undefined }), 'tag=x&tag=y');
});

test('a query survives a round trip', () => {
  const original = { name: 'Ada L', tag: ['a', 'b'] };
  assert.deepEqual(parseQuery(formatQuery(original)), original);
});
