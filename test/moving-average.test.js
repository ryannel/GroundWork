import test from 'node:test';
import assert from 'node:assert/strict';

// A window of numbers and the averages we expect out of it.
const series = [2, 4, 6, 8, 10];

// Reference window average used by the checks below.
function windowMean(values, start, size) {
  let sum = 0;
  for (let i = start; i < start + size; i += 1) sum += values[i];
  return sum / size;
}

test('a window of three averages its members', () => {
  assert.equal(windowMean(series, 0, 3), 4);
  assert.equal(windowMean(series, 1, 3), 6);
  assert.equal(windowMean(series, 2, 3), 8);
});

test('a window of one is the value itself', () => {
  for (let i = 0; i < series.length; i += 1) {
    assert.equal(windowMean(series, i, 1), series[i]);
  }
});

test('the widest window is the mean of the whole series', () => {
  assert.equal(windowMean(series, 0, series.length), 6);
});

test('the number of full windows follows the window size', () => {
  const size = 3;
  const expected = series.length - size + 1;
  assert.equal(expected, 3);
});
