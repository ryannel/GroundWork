// A tiny query-string reader and writer.

/**
 * Parse a query string into a plain object. A leading "?" is allowed.
 * Repeated keys collect into an array. Keys with no "=" get an empty string.
 * @param {string} input
 * @returns {Record<string, string | string[]>}
 */
export function parseQuery(input) {
  const out = {};
  const body = input.startsWith('?') ? input.slice(1) : input;
  if (body === '') return out;
  for (const part of body.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? '' : part.slice(eq + 1);
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    if (!(key in out)) {
      out[key] = val;
    } else if (Array.isArray(out[key])) {
      out[key].push(val);
    } else {
      out[key] = [out[key], val];
    }
  }
  return out;
}

/**
 * Turn an object back into a query string, without the leading "?".
 * Array values repeat the key. Null and undefined values are skipped.
 * @param {Record<string, unknown>} obj
 * @returns {string}
 */
export function formatQuery(obj) {
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}
