// Comparison fields are plain data. They are never used as executable HTML.
const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

const decode = (text: string): string =>
  text.replaceAll(/&(?:amp|lt|gt|quot|#x27|#39|nbsp);/gu, (entity) => ENTITIES[entity] ?? entity);

const words = (parts: readonly string[]): string =>
  decode(parts.join('')).replaceAll(/\s+/gu, ' ').trim();

function headingsOf(tokens: readonly string[]): readonly string[] {
  const headings: string[] = [];
  let parts: string[] | null = null;
  for (const token of tokens) {
    if (/^<h[1-6]\b/iu.test(token)) parts = [];
    else if (/^<\/h[1-6]\s*>$/iu.test(token)) {
      if (parts !== null) headings.push(words(parts));
      parts = null;
    } else if (parts !== null) parts.push(token.startsWith('<') ? ' ' : token);
  }
  return headings;
}

function tagEnd(html: string, start: number): number {
  for (let at = start + 1; at < html.length; at += 1) {
    if (html[at] === '>') return at + 1;
    if (html[at] === '<') break;
  }
  return start + 1;
}

// Streaming boundaries avoid regex stack limits on production HTML with large Flight chunks.
function* tokensOf(html: string): Generator<string> {
  let at = 0;
  const lastCommentEnd = html.lastIndexOf('-->');
  while (at < html.length) {
    const opening = html.indexOf('<', at);
    let end = opening === -1 ? html.length : opening;
    if (opening === at) {
      end =
        at + 4 <= lastCommentEnd && html.startsWith('<!--', at)
          ? html.indexOf('-->', at + 4) + 3
          : tagEnd(html, at);
    }
    yield html.slice(at, end);
    at = end;
  }
}

function visibleTokens(html: string): readonly string[] {
  const tokens: string[] = [];
  let raw: string | null = null;
  for (const token of tokensOf(html)) {
    const closing = /^<\/(script|style)\s*>$/iu.exec(token)?.[1]?.toLowerCase();
    if (raw !== null) {
      if (closing === raw) raw = null;
      continue;
    }
    const opening = /^<(script|style)\b/iu.exec(token)?.[1]?.toLowerCase();
    if (opening === undefined) {
      tokens.push(token);
    } else {
      raw = opening;
    }
  }
  return tokens;
}

export function htmlFields(
  html: string,
  at: URL,
): {
  readonly headings: readonly string[];
  readonly links: readonly string[];
  readonly payload: { readonly text: string; readonly inspectedIds: readonly string[] };
} {
  const tokens = visibleTokens(html);
  const tags = tokens.filter((token) => token.startsWith('<') && !token.startsWith('<!--'));
  const links = new Set<string>();
  const inspected = new Set<string>();
  for (const tag of tags) {
    for (const match of tag.matchAll(/\bhref="([^"]+)"/giu)) {
      const href = decode(match[1] ?? '');
      if (!URL.canParse(href, at)) continue;
      const target = new URL(href, at);
      if (target.origin === at.origin && !target.pathname.startsWith('/_next/')) {
        links.add(target.pathname + target.search + target.hash);
      }
    }
    for (const match of tag.matchAll(/\bdata-inspect="([^"]+)"/giu)) {
      inspected.add(decode(match[1] ?? ''));
    }
  }
  return {
    headings: headingsOf(tokens),
    links: [...links].toSorted((a, b) => a.localeCompare(b)),
    payload: {
      text: words(tokens.map((token) => (token.startsWith('<') ? ' ' : token))),
      inspectedIds: [...inspected].toSorted((a, b) => a.localeCompare(b)),
    },
  };
}
