import { inlineText, parseInline, parseMarkdown } from './markdown';

// Plan prose flattened to plain words, for titles, summaries and search. A citation [[id]] becomes whatever
// `label` says it is called.

type Label = (id: string) => string;

const TRAILING = new Set([' ', ',', ';', ':', '–', '—', '-']);

const folded = (text: string): string => text.split(/\s+/u).filter(Boolean).join(' ');

/** Stray emphasis and code marks a clip or a typo left behind. */
const unmarked = (text: string): string =>
  text.replaceAll('`', '').replaceAll('**', '').replaceAll('__', '');

/** Markdown and citations off, whitespace folded: for search and summaries. */
export function plain(text: string | null | undefined, label: Label): string {
  const lines = (text ?? '').split('\n').map((line) => line.replace(/^#+ ?/u, ''));
  const words = parseMarkdown(lines.join('\n')).map((block) =>
    block.kind === 'list'
      ? block.items.map((item) => inlineText(item.inlines, label)).join(' ')
      : inlineText(block.inlines, label),
  );
  return folded(unmarked(words.join(' ')));
}

/** A title as text: emphasis, code and link marks off, citations as labels, nothing else touched. */
export function plainTitle(text: string | null | undefined, label: Label): string {
  return folded(unmarked(inlineText(parseInline(folded(text ?? '')), label)));
}

/** Cut at n characters, at a word break when one is near, so text never ends mid-word. */
export function cutAtWord(text: string, n: number): string {
  if (text.length <= n) return text;
  const cut = text.slice(0, n - 1);
  const space = cut.lastIndexOf(' ');
  let kept = space >= n * 0.6 ? cut.slice(0, space) : cut;
  while (kept !== '' && TRAILING.has(kept.at(-1) ?? '')) kept = kept.slice(0, -1);
  return `${kept}…`;
}

/** Prose as at most n plain characters. */
export function clip(text: string | null | undefined, label: Label, n = 140): string {
  return cutAtWord(plain(text, label), n);
}
