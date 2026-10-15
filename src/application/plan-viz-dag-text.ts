interface Token {
  readonly text: string;
  /** No space before the next token: a long word broken in two. */
  readonly glue: boolean;
}

const BREAK_AFTER = /(?<=[/_.-])/;

function chunks(word: string, width: number): string[] {
  const pieces = word.split(BREAK_AFTER).flatMap((piece) => {
    if (piece.length <= width) return [piece];
    return Array.from({ length: Math.ceil(piece.length / width) }, (_, i) =>
      piece.slice(i * width, (i + 1) * width),
    );
  });
  return pieces;
}

function tokens(text: string, width: number): Token[] {
  return text
    .split(/\s+/)
    .filter((word) => word !== '')
    .flatMap((word) => {
      if (word.length <= width) return [{ text: word, glue: false }];
      const pieces = chunks(word, width);
      return pieces.map((piece, i) => ({ text: piece, glue: i < pieces.length - 1 }));
    });
}

function fill(list: readonly Token[], width: number): string[] {
  const lines: string[] = [];
  let line = '';
  let glue = false;
  for (const token of list) {
    const gap = glue ? '' : ' ';
    const next = line === '' ? token.text : `${line}${gap}${token.text}`;
    if (next.length > width && line !== '') {
      lines.push(line);
      line = token.text;
    } else line = next;
    glue = token.glue;
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** The last word, or its last six characters, dropped to make room for the ellipsis. */
function trimTail(line: string): string {
  const trimmed = line.trimEnd();
  const at = trimmed.lastIndexOf(' ');
  const tail = trimmed.length - at - 1;
  return trimmed.slice(0, tail <= TAIL ? Math.max(at, 0) : trimmed.length - TAIL).trimEnd();
}

const TAIL = 6;

/** Words wrapped to at most `max` lines of about `width` characters, an ellipsis where it overflows. */
export function wrapTitle(text: string, width: number, max: number): string[] {
  const lines = fill(tokens(text, width), width);
  if (lines.length <= max) return lines;
  const keep = lines.slice(0, max);
  const last = keep[max - 1] ?? '';
  keep[max - 1] = `${trimTail(last)}…`;
  return keep;
}
