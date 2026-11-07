/** A list of bare nouns ("Address, order, order.placed, PDF.") is a label, not something to remember. */
export function isFragment(text: string): boolean {
  const items = text
    .replaceAll(/[`*_]/gu, '')
    .replaceAll(/[.!]/gu, '')
    .split(',')
    .map((x) => x.trim());
  return items.length >= 3 && items.every((x) => x.split(' ').filter(Boolean).length <= 2);
}
