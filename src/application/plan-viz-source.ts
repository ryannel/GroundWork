import type { Source } from '@/domain/plan/plan.generated';

// How a source link reads: its own label, else "repo · file#L10-12" for GitHub, else host and path.

const GITHUB =
  /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/[^/]+\/([^#?]+)(?:#L(\d+)(?:-L?(\d+))?)?/u;

/** "#L10-20" for a line or a range, or "". */
function linesOf(line: string | undefined, end: string | undefined): string {
  if (line === undefined) return '';
  return end === undefined ? `#L${line}` : `#L${line}-${end}`;
}

function githubLabel(url: string): string | null {
  const m = GITHUB.exec(url);
  const repo = m?.[1];
  const path = m?.[2];
  if (repo === undefined || path === undefined) return null;
  const file = path.split('/').pop() ?? path;
  return `${repo.split('/')[1] ?? repo} · ${file}${linesOf(m?.[3], m?.[4])}`;
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
