// The small markdown plans are written in: paragraphs, "- " and "1. " lists, "> " quotes, **bold**, *em*,
// `code`, [text](url), bare URLs and [[id]] citations. It parses to plain data with a key on every piece, so
// React can render it without injecting HTML.

export type Inline = { readonly key: string } & (
  | { readonly kind: 'text' | 'code'; readonly text: string }
  | { readonly kind: 'strong' | 'em'; readonly children: readonly Inline[] }
  | { readonly kind: 'link'; readonly href: string; readonly text: string; readonly short: boolean }
  | { readonly kind: 'ref'; readonly id: string }
);

interface ListItem {
  readonly key: string;
  readonly inlines: readonly Inline[];
}

type Block = { readonly key: string } & (
  | { readonly kind: 'paragraph' | 'quote'; readonly inlines: readonly Inline[] }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly ListItem[] }
);

type WithoutKey<T> = T extends unknown ? Omit<T, 'key'> : never;
type Token = WithoutKey<Inline>;

interface Found {
  readonly token: Token;
  readonly end: number;
}

const ID = /^[a-z]+:[\w.#-]+$/;
const URL_END = new Set([' ', '\t', '\n', '<', '>', '"']);
const URL_TRAIL = new Set(['.', ',', ';', ':', '!', '?', ')']);

/** "github.com/…/transport.go#L47" for a long URL. */
export function shortUrl(url: string): string {
  const rest = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const cut = rest.search(/[/?#]/);
  const host = cut < 0 ? rest : rest.slice(0, cut);
  const tail = (cut < 0 ? '' : rest.slice(cut)).split(/[/?]/).findLast((part) => part !== '') ?? '';
  if (tail === '') return host;
  const short = tail.length > 40 ? `${tail.slice(0, 39)}…` : tail;
  return `${host}/…/${short}`;
}

function enclosed(text: string, at: number, marks: readonly [string, string]): Found | null {
  const [open, close] = marks;
  const end = text.indexOf(close, at + open.length);
  if (end === -1) return null;
  const inner = text.slice(at + open.length, end);
  const after = end + close.length;
  if (open === '[[')
    return ID.test(inner) ? { token: { kind: 'ref', id: inner }, end: after } : null;
  if (open === '`')
    return inner === '' ? null : { token: { kind: 'code', text: inner }, end: after };
  if (inner === '' || inner.includes('*') || inner.startsWith(' ')) return null;
  const kind = open === '**' ? 'strong' : 'em';
  return { token: { kind, children: parseInline(inner) }, end: after };
}

function link(text: string, at: number): Found | null {
  const middle = text.indexOf('](', at);
  const end = middle === -1 ? -1 : text.indexOf(')', middle);
  if (end < 0) return null;
  const label = text.slice(at + 1, middle);
  const href = text.slice(middle + 2, end);
  if (label === '' || label.includes(']') || !href.startsWith('http') || /\s/.test(href))
    return null;
  return { token: { kind: 'link', href, text: label, short: false }, end: end + 1 };
}

function bareUrl(text: string, at: number): Found | null {
  const before = text[at - 1];
  if (before !== undefined && before !== ' ' && before !== '(') return null;
  if (!text.startsWith('http://', at) && !text.startsWith('https://', at)) return null;
  let end = at;
  while (end < text.length && !URL_END.has(text.charAt(end))) end += 1;
  while (end > at && URL_TRAIL.has(text.charAt(end - 1))) end -= 1;
  const href = text.slice(at, end);
  return { token: { kind: 'link', href, text: shortUrl(href), short: true }, end };
}

function tokenAt(text: string, at: number): Found | null {
  if (text.startsWith('[[', at)) return enclosed(text, at, ['[[', ']]']);
  if (text.startsWith('`', at)) return enclosed(text, at, ['`', '`']);
  if (text.startsWith('**', at)) return enclosed(text, at, ['**', '**']);
  if (text.startsWith('*', at)) return enclosed(text, at, ['*', '*']);
  if (text.startsWith('[', at)) return link(text, at);
  if (text.startsWith('h', at)) return bareUrl(text, at);
  return null;
}

/** One line of prose as runs of text, code, emphasis, links and citations. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let start = 0;
  let at = 0;
  while (at < text.length) {
    const found = tokenAt(text, at);
    if (found === null) {
      at += 1;
      continue;
    }
    if (at > start) out.push({ key: String(start), kind: 'text', text: text.slice(start, at) });
    out.push({ key: String(at), ...found.token });
    at = found.end;
    start = at;
  }
  if (text.length > start) out.push({ key: String(start), kind: 'text', text: text.slice(start) });
  return out;
}

type LineKind = 'bullet' | 'number' | 'quote' | 'text';

function lineKind(line: string): [LineKind, string] {
  if (/^[-*]\s/.test(line)) return ['bullet', line.slice(1).trimStart()];
  const number = /^\d+[.)]\s/.exec(line);
  if (number !== null) return ['number', line.slice(number[0].length).trimStart()];
  if (line.startsWith('>')) return ['quote', line.slice(1).trimStart()];
  return ['text', line];
}

function blockOf(kind: LineKind, lines: readonly string[], key: string): Block {
  if (kind === 'text') return { key, kind: 'paragraph', inlines: parseInline(lines.join(' ')) };
  if (kind === 'quote') return { key, kind: 'quote', inlines: parseInline(lines.join(' ')) };
  const items = lines.map((line, index) => ({ key: String(index), inlines: parseInline(line) }));
  return { key, kind: 'list', ordered: kind === 'number', items };
}

/** Text as blocks; nothing for empty text. */
export function parseMarkdown(text: string | null | undefined): Block[] {
  const blocks: Block[] = [];
  let kind: LineKind | null = null;
  let lines: string[] = [];
  const flush = (): void => {
    if (kind !== null && lines.length > 0) blocks.push(blockOf(kind, lines, String(blocks.length)));
    kind = null;
    lines = [];
  };
  for (const raw of (text ?? '').replaceAll('\r', '').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      flush();
      continue;
    }
    const [next, body] = lineKind(line);
    if (next !== kind) flush();
    kind = next;
    lines.push(body);
  }
  flush();
  return blocks;
}

/** Inline runs as plain words, each citation as `label` says. */
export function inlineText(inlines: readonly Inline[], label: (id: string) => string): string {
  return inlines
    .map((run) => {
      switch (run.kind) {
        case 'text':
        case 'code': {
          return run.text;
        }
        case 'strong':
        case 'em': {
          return inlineText(run.children, label);
        }
        case 'link': {
          return run.short ? run.href : run.text;
        }
        case 'ref': {
          return label(run.id);
        }
      }
    })
    .join('');
}
