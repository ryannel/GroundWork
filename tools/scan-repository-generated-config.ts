const PREFIX =
  "import { createActionConfig } from '../rolldown.config.mjs' ; export default createActionConfig ( [";
const SUFFIX = '] ) ;';
interface BuildEntry {
  readonly input: string;
  readonly output: string;
}

/** A closed token grammar; quoted text and identifier boundaries remain distinct. */
export function generatedRecipeTokens(text: string): readonly string[] {
  if (text.includes('\\')) return [];
  return (text.match(/'[^'\r\n]*'|"[^"\r\n]*"|[\w$]+|\S/gu) ?? []).map((token) =>
    token.startsWith('"') ? `'${token.slice(1, -1)}'` : token,
  );
}
function modulePath(token: string | undefined): string | undefined {
  if (token === undefined || !/^'(?:[\w-]+\/)*[\w-]+\.mjs'$/u.test(token)) return undefined;
  return token.slice(1, -1);
}
function entryAt(
  tokens: readonly string[],
): { readonly entry: BuildEntry; readonly width: number } | undefined {
  if (tokens.slice(0, 3).join(' ') !== '{ input :') return undefined;
  if (tokens.slice(4, 7).join(' ') !== ', file :') return undefined;
  const input = modulePath(tokens[3]);
  const output = modulePath(tokens[7]);
  if (input === undefined || output === undefined) return undefined;
  if (input.split('/').includes('dist') || !output.startsWith('dist/')) return undefined;
  const closing = tokens[8] === ',' ? 9 : 8;
  if (tokens[closing] !== '}') return undefined;
  const width = closing + 1;
  return { entry: { input, output }, width };
}

/** Only static source/output pairs with safe relative module paths are supported. */
export function generatedActionEntries(text: string): readonly BuildEntry[] | undefined {
  const tokens = generatedRecipeTokens(text);
  if (tokens.slice(0, 12).join(' ') !== PREFIX) return undefined;
  if (tokens.slice(-3).join(' ') !== SUFFIX) return undefined;
  const body = tokens.slice(12, -3);
  const entries: BuildEntry[] = [];
  let position = 0;
  while (position < body.length) {
    const parsed = entryAt(body.slice(position));
    if (parsed === undefined) return undefined;
    entries.push(parsed.entry);
    position += parsed.width;
    if (position === body.length) break;
    if (body[position] !== ',') return undefined;
    position += 1;
  }
  if (entries.length === 0) return undefined;
  if (new Set(entries.map((entry) => entry.output)).size !== entries.length) return undefined;
  return entries;
}
