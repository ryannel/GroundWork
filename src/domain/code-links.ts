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
