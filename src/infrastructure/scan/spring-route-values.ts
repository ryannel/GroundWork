import 'server-only';

interface AnnotationCursor {
  readonly depth: number;
  readonly quoted: boolean;
  readonly escaped: boolean;
}

function advance(character: string, previous: AnnotationCursor): AnnotationCursor {
  const state = { ...previous };
  if (state.escaped) {
    state.escaped = false;
    return state;
  }
  if (state.quoted && character === '\\') {
    state.escaped = true;
    return state;
  }
  if (character === '"') state.quoted = !state.quoted;
  if (state.quoted) return state;
  if ('({[<'.includes(character)) state.depth += 1;
  if (')}]>'.includes(character)) state.depth -= 1;
  return state;
}

/** Split Java annotation values without confusing nested arrays, calls or quoted commas. */
export function springAnnotationValues(value: string): readonly string[] {
  const values: string[] = [];
  let state: AnnotationCursor = { depth: 0, quoted: false, escaped: false };
  let start = 0;
  for (let position = 0; position < value.length; position += 1) {
    const character = value[position] ?? '';
    const previous = state;
    state = advance(character, state);
    if (character === ',' && !previous.quoted && !state.quoted && state.depth === 0) {
      values.push(value.slice(start, position).trim());
      start = position + 1;
    }
  }
  values.push(value.slice(start).trim());
  return values.filter(Boolean);
}

export function springLiteral(value: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function springStrings(value?: string): readonly string[] | undefined {
  if (value === undefined) return [];
  const raw = value.trim();
  const items = springAnnotationValues(raw.startsWith('{') ? raw.slice(1, -1) : raw);
  const literals = items.map(springLiteral);
  return literals.every((item) => item !== undefined) ? literals : undefined;
}

export function springPath(prefix: string, path: string): string {
  const pathValue = `/${prefix}/${path}`.replaceAll(/\/{2,}/gu, '/').replace(/\/$/u, '');
  return pathValue === '' ? '/' : pathValue;
}
