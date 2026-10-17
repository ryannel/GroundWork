// What counts as drifting from the design system, and whether things got better or worse.
// Feature CSS lays things out; how things look belongs to src/ui.

const VISUAL_PREFIXES = [
  'background',
  'border',
  'outline',
  'font',
  'text-decoration',
  'text-transform',
  'stroke',
];
const VISUAL = new Set([
  'color',
  'box-shadow',
  'text-shadow',
  'letter-spacing',
  'line-height',
  'cursor',
  'opacity',
  'fill',
  'appearance',
]);
const VENDOR_PSEUDO = /::-(?:webkit|moz)-/gu;
const RAW_CONTROL = /<(?:button|input|select|textarea|progress|table)[\s/>]/gu;
const COMMENT = /\/\*[\s\S]*?\*\//gu;
const MARKS = new Set(['{', '}', ';']);
const MIN_SHARED = 3;

export interface Rule {
  readonly selector: string;
  readonly declarations: readonly string[];
}

export interface Counts {
  readonly visual: Readonly<Record<string, number>>;
  readonly controls: Readonly<Record<string, number>>;
  readonly duplicates: number;
}

export interface Verdict {
  readonly worse: readonly string[];
  readonly better: readonly string[];
}

interface Token {
  readonly text: string;
  readonly mark: string;
}

function tokensOf(css: string): Token[] {
  const tokens: Token[] = [];
  let text = '';
  for (const char of css.replaceAll(COMMENT, '')) {
    if (MARKS.has(char)) {
      tokens.push({ text: text.trim().replaceAll(/\s+/gu, ' '), mark: char });
      text = '';
    } else {
      text += char;
    }
  }
  return tokens;
}

function isDeclaration(token: Token): boolean {
  return token.mark !== '{' && token.text.includes(':');
}

function propertyOf(declaration: string): string {
  return declaration.slice(0, declaration.indexOf(':')).trim().toLowerCase();
}

function isVisual(property: string): boolean {
  return VISUAL.has(property) || VISUAL_PREFIXES.some((prefix) => property.startsWith(prefix));
}

/** Each innermost rule in a stylesheet: a selector whose block holds no other block. */
export function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  let selector = '';
  let declarations: string[] = [];
  let leaf = false;
  for (const token of tokensOf(css)) {
    if (token.mark === '{') {
      [selector, declarations, leaf] = [token.text, [], true];
      continue;
    }
    if (leaf && isDeclaration(token)) declarations.push(token.text);
    if (leaf && token.mark === '}') {
      rules.push({ selector, declarations });
      leaf = false;
    }
  }
  return rules;
}

/** How many declarations and vendor pseudo-elements in a feature stylesheet are about looks. */
export function visualCount(css: string): number {
  const looks = tokensOf(css).filter(
    (token) => isDeclaration(token) && isVisual(propertyOf(token.text)),
  );
  return looks.length + (css.match(VENDOR_PSEUDO)?.length ?? 0);
}

/** How many raw controls a feature component draws instead of using src/ui. */
export function controlCount(tsx: string): number {
  return tsx.match(RAW_CONTROL)?.length ?? 0;
}

/** Rule bodies of three or more declarations that appear in more than one stylesheet. */
export function duplicateGroups(sheets: Readonly<Record<string, string>>): string[][] {
  const seen = new Map<string, Set<string>>();
  for (const [file, css] of Object.entries(sheets)) {
    for (const rule of rulesOf(css)) {
      if (rule.declarations.length < MIN_SHARED) continue;
      const key = rule.declarations.toSorted((a, b) => a.localeCompare(b)).join('; ');
      seen.set(key, (seen.get(key) ?? new Set()).add(file));
    }
  }
  return [...seen.entries()]
    .filter(([, files]) => files.size > 1)
    .map(([key, files]) => [key, ...files]);
}

function compareCounts(
  kind: string,
  before: Readonly<Record<string, number>>,
  now: Readonly<Record<string, number>>,
): Verdict {
  const worse: string[] = [];
  const better: string[] = [];
  for (const file of new Set([...Object.keys(before), ...Object.keys(now)])) {
    const was = before[file] ?? 0;
    const is = now[file] ?? 0;
    const line = `${file}: ${kind} ${String(was)} → ${String(is)}`;
    if (is > was) worse.push(line);
    if (is < was) better.push(line);
  }
  return { worse, better };
}

/** What got worse and what got better since the baseline. */
export function compare(baseline: Counts, now: Counts): Verdict {
  const visual = compareCounts('visual styling', baseline.visual, now.visual);
  const controls = compareCounts('raw controls', baseline.controls, now.controls);
  const shared = compareCounts(
    'duplicated rules',
    { all: baseline.duplicates },
    { all: now.duplicates },
  );
  return {
    worse: [...visual.worse, ...controls.worse, ...shared.worse],
    better: [...visual.better, ...controls.better, ...shared.better],
  };
}

function tallyOf(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Design drift baseline is not a tally.');
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry: readonly [string, unknown]): entry is [string, number] =>
        typeof entry[1] === 'number',
    ),
  );
}

/** Reads a baseline written by the tool, refusing anything else. */
export function countsOf(value: unknown): Counts {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Design drift baseline is not an object.');
  }
  if (!('visual' in value && 'controls' in value && 'duplicates' in value)) {
    throw new Error('Design drift baseline is missing its counts.');
  }
  if (typeof value.duplicates !== 'number') {
    throw new TypeError('Design drift baseline has no duplicate count.');
  }
  return {
    visual: tallyOf(value.visual),
    controls: tallyOf(value.controls),
    duplicates: value.duplicates,
  };
}
