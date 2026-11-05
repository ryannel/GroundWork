import { parseGitHostUrl } from '@/domain/code-links';
import type { Source } from '@/domain/plan/plan.generated';

// How a source link reads: its own label, else "repo · file#L10-12" for GitHub, else host and path.

function githubLabel(url: string): string | null {
  const link = parseGitHostUrl(url);
  if (link?.host !== 'github.com' || link.kind !== 'blob') return null;
  const file = link.rawPath.split('/').pop() ?? link.rawPath;
  const repo = link.repo.split('/')[1] ?? link.repo;
  const span = link.lines;
  const end = span !== undefined && link.explicitRange ? `-${String(span[1])}` : '';
  const lines = span === undefined ? '' : `#L${String(span[0])}${end}`;
  return `${repo} · ${file}${lines}`;
}

export function sourceLabel(src: Pick<Source, 'url' | 'label'>): string {
  if (src.label !== undefined && src.label !== '') return src.label;
  const gh = githubLabel(src.url);
  if (gh !== null) return gh;
  try {
    const u = new URL(src.url);
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return src.url;
  }
}
