// The tokenizer and cursor of the GraphQL document parser.

export interface Token {
  readonly t: 'p' | 'n' | 'v';
  readonly v: string;
  readonly line: number;
}

type Kind = Token['t'] | 'skip';

const RULES: readonly (readonly [Kind, RegExp])[] = [
  ['skip', /^(?:[\s,]+|#[^\n]*)/u],
  ['p', /^(?:\.\.\.|[!$&():=@[\]{|}])/u],
  ['n', /^[_A-Za-z]\w*/u],
  ['v', /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/iu],
  ['v', /^"""[\s\S]*?"""/u],
  ['v', /^"(?:[^"\\\n]|\\.)*"/u],
];

const newlines = (text: string): number => text.split('\n').length - 1;

function badToken(text: string, line: number): SyntaxError {
  if (text === '"') {
    return new SyntaxError(`line ${String(line)}: unterminated string`);
  }
  return new SyntaxError(`line ${String(line)}: unexpected "${text}"`);
}

function matchAt(rest: string): { readonly kind: Kind | null; readonly text: string } {
  for (const [kind, re] of RULES) {
    const m = re.exec(rest);
    if (m !== null) return { kind, text: m[0] };
  }
  return { kind: null, text: rest.slice(0, 1) };
}

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let line = 1;
  let pos = 0;
  while (pos < src.length) {
    const { kind, text } = matchAt(src.slice(pos));
    if (kind === null) throw badToken(text, line);
    if (kind !== 'skip') out.push({ t: kind, v: text, line });
    line += newlines(text);
    pos += text.length;
  }
  return out;
}

export interface Cursor {
  readonly peek: () => Token | undefined;
  readonly at: (v: string) => boolean;
  readonly atName: (v?: string) => boolean;
  readonly next: () => Token;
  readonly back: () => void;
  readonly eat: (v: string) => void;
  readonly name: () => string;
  readonly fail: (what: string) => never;
  readonly skipGroup: (open: string, close: string) => void;
}

export function createCursor(tokens: readonly Token[]): Cursor {
  let i = 0;
  const peek = (): Token | undefined => tokens[i];
  const fail = (what: string): never => {
    const t = peek();
    throw new SyntaxError(
      t === undefined
        ? `eated ${what}, found the end of the document`
        : `line ${String(t.line)}: eated ${what}, found "${t.v}"`,
    );
  };
  const at = (v: string): boolean => {
    const t = peek();
    return t !== undefined && t.t !== 'v' && t.v === v;
  };
  const atName = (v?: string): boolean => {
    const t = peek();
    return t?.t === 'n' && (v === undefined || t.v === v);
  };
  const next = (): Token => {
    const t = tokens[i];
    if (t === undefined) return fail('more');
    i += 1;
    return t;
  };
  const eat = (v: string): void => {
    if (!at(v)) fail(`"${v}"`);
    next();
  };
  const name = (): string => {
    if (!atName()) fail('a name');
    return next().v;
  };
  const skipGroup = (open: string, close: string): void => {
    eat(open);
    let depth = 1;
    while (depth > 0) {
      const t = next();
      if (t.t !== 'p') continue;
      if (t.v === open) depth += 1;
      else if (t.v === close) depth -= 1;
    }
  };
  return {
    peek,
    at,
    atName,
    next,
    back: () => {
      i -= 1;
    },
    eat,
    name,
    fail,
    skipGroup,
  };
}
