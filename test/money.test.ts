import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount, sum } from '../src/money.ts';

test('parseAmount reads plain decimals', () => {
  assert.equal(parseAmount('12.34'), 1234);
  assert.equal(parseAmount('0.05'), 5);
  assert.equal(parseAmount('7'), 700);
  assert.equal(parseAmount('12.3'), 1230);
});

test('parseAmount ignores symbols and separators', () => {
  assert.equal(parseAmount(' £12.34 '), 1234);
  assert.equal(parseAmount('1,200.00'), 120000);
  assert.equal(parseAmount('$0.99'), 99);
});

test('parseAmount keeps the sign', () => {
  assert.equal(parseAmount('-3.50'), -350);
});

test('parseAmount rejects rubbish', () => {
  for (const bad of ['', 'twelve', '1.234', '1.2.3', '--4']) {
    assert.throws(() => parseAmount(bad), /not an amount/, `expected ${bad} to be rejected`);
  }
});

test('formatAmount prints two decimal places', () => {
  assert.equal(formatAmount(1234), '12.34');
  assert.equal(formatAmount(5), '0.05');
  assert.equal(formatAmount(700), '7.00');
  assert.equal(formatAmount(-350), '-3.50');
  assert.equal(formatAmount(0), '0.00');
});

test('parse and format round-trip', () => {
  for (const text of ['12.34', '0.05', '7.00', '-3.50', '120000.00']) {
    assert.equal(formatAmount(parseAmount(text)), text);
  }
});

test('sum adds minor units', () => {
  assert.equal(sum([1234, 5, -350]), 889);
  assert.equal(sum([]), 0);
});
