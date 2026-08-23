// Rolling window averages over a series of numbers.

/**
 * Simple moving average over a window of the given size.
 * The result has one entry per full window, so its length is
 * values.length - size + 1. A window wider than the series gives [].
 * @param {number[]} values
 * @param {number} size
 * @returns {number[]}
 */
export function movingAverage(values, size) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError('window size must be a positive integer');
  }
  if (values.length < size) return [];
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= size) sum -= values[i - size];
    if (i >= size - 1) out.push(sum / size);
  }
  return out;
}

/**
 * The last window average of the series, or null when the series is too short.
 * @param {number[]} values
 * @param {number} size
 * @returns {number | null}
 */
export function latestAverage(values, size) {
  const all = movingAverage(values, size);
  return all.length === 0 ? null : all[all.length - 1];
}
