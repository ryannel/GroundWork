/**
 * Amounts are integers in minor units (pence, cents). Text only appears at
 * the edges: when a user types an amount, and when one is printed.
 */

const AMOUNT = /^-?\d+(\.\d{1,2})?$/;

/** Reads "12.34", "£12.34" or "1,200" and returns the amount in minor units. */
export function parseAmount(input: string): number {
  const cleaned = input.trim().replace(/[£$€,\s]/g, '');
  if (!AMOUNT.test(cleaned)) {
    throw new Error(`not an amount: ${input}`);
  }
  const negative = cleaned.startsWith('-');
  const [whole, fraction = ''] = cleaned.replace('-', '').split('.');
  const minor = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return negative ? -minor : minor;
}

/** Prints minor units with two decimal places and no currency symbol. */
export function formatAmount(minor: number): string {
  const rounded = Math.round(minor);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Adds amounts that are already in minor units. */
export function sum(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
