/**
 * A first guess at the category of an expense, taken from its description.
 * The user can always override it, so a wrong guess is cheap.
 */

const RULES: Array<[RegExp, string]> = [
  [/coffee|cafe|canteen|restaurant|lunch/i, 'meals'],
  [/train|rail|taxi|fuel|petrol|parking/i, 'travel'],
  [/hotel|inn|lodge|airbnb/i, 'accommodation'],
  [/paper|toner|stationery|pens?\b/i, 'office'],
  [/licence|license|subscription|hosting/i, 'software'],
];

export const FALLBACK = 'uncategorised';

/** Returns the category for a description, or the fallback. */
export function categorize(description: string): string {
  for (const [pattern, category] of RULES) {
    if (pattern.test(description)) {
      return category;
    }
  }
  return FALLBACK;
}

/** The categories this module can produce, in rule order. */
export function categories(): string[] {
  return [...new Set(RULES.map(([, category]) => category)), FALLBACK];
}
