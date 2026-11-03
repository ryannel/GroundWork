const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

function glyphWidth(glyph: string): number {
  if (/[MW@%]/u.test(glyph)) return 12;
  return /[ ilI.,:;'!|]/u.test(glyph) ? 4 : 7.5;
}

function textWidth(text: string): number {
  return Array.from(graphemes.segment(text), (part) => glyphWidth(part.segment)).reduce(
    (sum, width) => sum + width,
    16,
  );
}

function clipped(text: string): string {
  const letters = Array.from(graphemes.segment(text), (part) => part.segment);
  return letters.length > 25 ? `${letters.slice(0, 24).join('')}…` : text;
}

function operationCaption(label: string): string {
  const [method, path] = label.split(/\s+/u);
  if (
    path?.startsWith('/') !== true ||
    !/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?:\|[A-Z]+)*$/u.test(method ?? '')
  ) {
    return label;
  }
  const operation =
    path
      .split('?')[0]
      ?.split('/')
      .findLast((part) => part !== '' && !part.startsWith('{')) ?? path;
  return `${method ?? ''} ${operation}`;
}

/** The text and space used by every connection caption. Full explanations stay on the connection. */
export function diagramCaption(label: string): {
  readonly lines: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly lineHeight: number;
} {
  const compact = operationCaption(label)
    .replaceAll(/\band\b/gu, '&')
    .replaceAll(/\s+/gu, ' ')
    .trim();
  const words = compact.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line !== '' && `${line} ${word}`.length > 25) {
      lines.push(line);
      line = '';
    }
    line = line === '' ? word : `${line} ${word}`;
  }
  if (line !== '') lines.push(line);
  const visible = lines.slice(0, 2).map(clipped);
  if (lines.length > 2) visible[1] = `${visible[1] ?? ''}…`;
  return {
    lines: visible,
    width: Math.max(48, ...visible.map(textWidth)),
    height: Math.max(18, visible.length * 16 + 2),
    lineHeight: 16,
  };
}
