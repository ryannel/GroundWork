// Title casing that leaves small joining words alone.

const SMALL = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in',
  'of', 'on', 'or', 'the', 'to', 'vs',
]);

/**
 * Capitalise a single word.
 * @param {string} word
 * @returns {string}
 */
export function capitalize(word) {
  if (word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Title-case a phrase. Small joining words stay lower case unless they are
 * the first or the last word.
 * @param {string} text
 * @returns {string}
 */
export function titleCase(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      const edge = i === 0 || i === words.length - 1;
      return !edge && SMALL.has(lower) ? lower : capitalize(w);
    })
    .join(' ');
}
