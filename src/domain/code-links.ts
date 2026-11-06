import { hasPrefix, parseId } from '#domain/ids';

// Git-host addresses are derived here; callers retain structured repository and code references.
export interface CodeLocation {
  readonly repo: string;
  readonly path: string;
  readonly commit: string;
  readonly lines?: readonly [number, number];
}
export interface LinkStyle {
  readonly encoding?: 'uri' | 'segments' | 'raw';
  readonly range?: 'always' | 'compact';
  readonly host?: string;
}
const encodePath = (path: string, encoding: LinkStyle['encoding']): string => {
  if (encoding === 'raw') return path;
  return encoding === 'segments'
    ? path.split('/').map(encodeURIComponent).join('/')
    : encodeURI(path);
};
export function repositoryUrl(repo: string, host?: string): string {
  if (repo.includes('://')) return repo.replace(/\/$/u, '');
  const implicit = repo.split('/').length > 2 ? repo : `github.com/${repo}`;
  const full = host === undefined ? implicit : `${host}/${repo}`;
  return `https://${full}`;
}
export function homeUrlOf(home: { readonly repo: string; readonly path?: string | null }): string {
  const base = repositoryUrl(home.repo);
  return home.path === undefined || home.path === null ? base : `${base}/tree/HEAD/${home.path}`;
}
export function issueUrlOf(repo: string, issue: number): string {
  return `${repositoryUrl(repo)}/issues/${String(issue)}`;
}
export function remoteUrlOf(repo: string): string {
  return `${repositoryUrl(repo)}.git`;
}
export function permalinkOf(source: CodeLocation, style: LinkStyle = {}): string {
  const base = `${repositoryUrl(style.host === undefined ? source.repo : encodePath(source.repo, 'segments'), style.host)}/blob/${source.commit}/${encodePath(source.path, style.encoding)}`;
  if (source.lines === undefined) return base;
  const [from, to] = source.lines;
  return from === to && style.range !== 'always'
    ? `${base}#L${String(from)}`
    : `${base}#L${String(from)}-L${String(to)}`;
}
export interface GitHostLink {
  readonly host: string;
  readonly repo: string;
  readonly kind: string;
  readonly commit: string | undefined;
  readonly path: string;
  readonly rawPath: string;
  readonly lines: readonly [number, number] | undefined;
  readonly explicitRange: boolean;
}
export function parseCodeLines(hash: string): readonly [number, number] | undefined {
  const match = /^#?L(\d+)(?:-L?(\d+))?$/u.exec(hash);
  return match?.[1] === undefined ? undefined : [Number(match[1]), Number(match[2] ?? match[1])];
}
function gitLink(url: URL): GitHostLink | null {
  const parts = url.pathname.slice(1).split('/');
  if (parts.length < 2 || parts.slice(0, 2).includes('')) return null;
  const marker = parts.findIndex(
    (part, index) => index >= 2 && ['blob', 'tree', 'issues', 'pull'].includes(part),
  );
  const end = marker === -1 ? parts.length : marker;
  const repoEnd = marker !== -1 && parts[end - 1] === '-' ? end - 1 : end;
  const repoParts = parts.slice(0, repoEnd);
  const rawPath = marker === -1 ? '' : parts.slice(marker + 2).join('/');
  return {
    host: url.hostname,
    repo: repoParts.join('/').replace(/\.git$/u, ''),
    kind: marker === -1 ? 'home' : (parts[marker] ?? 'home'),
    commit: marker === -1 ? undefined : parts[marker + 1],
    path: decodeURIComponent(rawPath),
    rawPath,
    lines: parseCodeLines(url.hash),
    explicitRange: url.hash.includes('-'),
  };
}
/** Accept Git remotes and Git-host links, returning null for malformed input. */
export function parseGitHostUrl(text: string): GitHostLink | null {
  const remote = text.trim();
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/u.exec(remote);
  const candidate = scp === null ? remote : `ssh://${scp[1] ?? ''}/${scp[2] ?? ''}`;
  if (!URL.canParse(candidate)) return null;
  const url = new URL(candidate);
  if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) return null;
  try {
    return gitLink(url);
  } catch {
    return null;
  }
}
/** GitHub's host is implicit in the legacy repository identity. */
export function repositoryOf(text: string): string | undefined {
  const parsed = parseGitHostUrl(text);
  if (parsed === null) return undefined;
  return parsed.host === 'github.com' ? parsed.repo : `${parsed.host}/${parsed.repo}`;
}
export function normaliseRepository(repo: string): string {
  return repo.replace(/^github\.com\//u, '');
}

/** A source citation before its home and repository pin have been resolved. */
export type AuthoredCodeCitation =
  | { readonly kind: 'evidence'; readonly id: string }
  | { readonly kind: 'inherited'; readonly lines: readonly [number, number] }
  | {
      readonly kind: 'home';
      readonly home: string;
      readonly path: string;
      readonly commit?: string;
      readonly lines: readonly [number, number] | undefined;
      readonly symbol: string | undefined;
    };
function validCodeLines(text: string): readonly [number, number] | undefined {
  const span = parseCodeLines(text);
  return span !== undefined && span[0] > 0 && span[1] >= span[0] ? span : undefined;
}
function historicalPath(text: string): {
  readonly path: string;
  readonly commit?: string;
} {
  const at = text.lastIndexOf('@');
  const commit = at === -1 ? undefined : text.slice(at + 1);
  return commit !== undefined && /^[a-f0-9]{7,64}$/u.test(commit)
    ? { path: text.slice(0, at), commit }
    : { path: text };
}
/** Accept home:path@commit#Lstart-end Symbol; missing information remains unresolved. */
export function parseAuthoredCodeCitation(text: string): AuthoredCodeCitation | null {
  if (hasPrefix(text, 'ev')) {
    const evidence = parseId(text);
    return evidence?.path.length === 0 ? { kind: 'evidence', id: text } : null;
  }
  if (text.startsWith('#L')) {
    const lines = validCodeLines(text);
    return lines === undefined ? null : { kind: 'inherited', lines };
  }
  const colon = text.indexOf(':');
  const home = text.slice(0, colon);
  if (colon < 1 || !/^[a-z][a-z0-9-]*$/u.test(home)) return null;
  if (home === 'http' || home === 'https') return null;
  const location = homeCitationLocation(text.slice(colon + 1));
  return location === null ? null : { kind: 'home', home, ...location };
}

function homeCitationLocation(
  tail: string,
): Omit<Extract<AuthoredCodeCitation, { readonly kind: 'home' }>, 'kind' | 'home'> | null {
  const marker = tail.indexOf('#L');
  const lineText = marker === -1 ? '' : (tail.slice(marker + 1).split(/\s+/u)[0] ?? '');
  const lines = marker < 0 ? undefined : validCodeLines(lineText);
  if (marker >= 0 && lines === undefined) return null;
  const path = historicalPath(marker < 0 ? tail : tail.slice(0, marker));
  if (path.path === '') return null;
  const symbol = marker < 0 ? '' : tail.slice(marker + 1 + lineText.length).trim();
  return { ...path, lines, symbol: symbol === '' ? undefined : symbol };
}
/** A path stays inside its declared repository home; no host URL is stored. */
export function codePathInHome(path: string, home?: string): string | null {
  if (path.startsWith('/') || path.includes('\\')) return null;
  const parts = [home ?? '', path]
    .flatMap((part) => part.split('/'))
    .filter((part) => part !== '' && part !== '.');
  return parts.includes('..') ? null : parts.join('/');
}
