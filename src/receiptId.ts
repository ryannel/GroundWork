/**
 * Receipt identifiers look like `R-20240105-0007`: the date the receipt was
 * filed, then a sequence number for that day.
 */

const PATTERN = /^R-(\d{8})-(\d{4})$/;

/** Builds an identifier from an ISO date and a sequence number. */
export function receiptId(day: string, sequence: number): string {
  const compact = day.replaceAll('-', '');
  if (compact.length !== 8) {
    throw new Error(`not a date: ${day}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error(`sequence out of range: ${sequence}`);
  }
  return `R-${compact}-${String(sequence).padStart(4, '0')}`;
}

/** True when text has the shape of a receipt identifier. */
export function isReceiptId(text: string): boolean {
  return PATTERN.test(text);
}

/** Pulls the ISO date back out of an identifier. */
export function dayOf(text: string): string {
  const found = PATTERN.exec(text);
  if (found === null) {
    throw new Error(`not a receipt id: ${text}`);
  }
  const compact = found[1]!;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}
