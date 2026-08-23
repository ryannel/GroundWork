// Human-readable byte sizes.

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/**
 * Format a byte count using 1024-based units, e.g. 2048 -> "2 KB".
 * Values under 1 KB never show a decimal point.
 * @param {number} bytes
 * @param {number} [digits] decimal places for units above bytes
 * @returns {string}
 */
export function formatBytes(bytes, digits = 1) {
  if (!Number.isFinite(bytes)) throw new TypeError('bytes must be a finite number');
  const sign = bytes < 0 ? '-' : '';
  let n = Math.abs(bytes);
  let unit = 0;
  while (n >= 1024 && unit < UNITS.length - 1) {
    n /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(n) : String(Number(n.toFixed(digits)));
  return `${sign}${text} ${UNITS[unit]}`;
}

/**
 * Read a size back into a byte count, e.g. "2 KB" -> 2048.
 * @param {string} text
 * @returns {number}
 */
export function parseBytes(text) {
  const m = /^\s*(-?[\d.]+)\s*([A-Za-z]*)\s*$/.exec(text);
  if (!m) throw new SyntaxError(`not a size: ${text}`);
  const unit = (m[2] || 'B').toUpperCase();
  const power = UNITS.indexOf(unit);
  if (power === -1) throw new SyntaxError(`unknown unit: ${m[2]}`);
  return Number(m[1]) * 1024 ** power;
}
