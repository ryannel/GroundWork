// Retry delay schedules.

/**
 * Exponential backoff delay in milliseconds for a zero-based attempt number.
 * The delay doubles each attempt and stops growing at maxMs.
 * @param {number} attempt
 * @param {{ baseMs?: number, maxMs?: number, factor?: number }} [opts]
 * @returns {number}
 */
export function backoffDelay(attempt, opts = {}) {
  const { baseMs = 100, maxMs = 30000, factor = 2 } = opts;
  if (attempt < 0) throw new RangeError('attempt must not be negative');
  const raw = baseMs * factor ** attempt;
  return Math.min(raw, maxMs);
}

/**
 * The whole schedule of delays for a number of attempts.
 * @param {number} attempts
 * @param {{ baseMs?: number, maxMs?: number, factor?: number }} [opts]
 * @returns {number[]}
 */
export function backoffSchedule(attempts, opts = {}) {
  const out = [];
  for (let i = 0; i < attempts; i += 1) out.push(backoffDelay(i, opts));
  return out;
}

/**
 * Total wall time a schedule spends waiting.
 * @param {number} attempts
 * @param {{ baseMs?: number, maxMs?: number, factor?: number }} [opts]
 * @returns {number}
 */
export function totalWait(attempts, opts = {}) {
  return backoffSchedule(attempts, opts).reduce((a, b) => a + b, 0);
}
