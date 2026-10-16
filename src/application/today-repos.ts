import { systemMapOf } from '@/application/system-map';
import type { SystemModel } from '@/application/workspace-model';
import type { Workspace } from '@/domain/workspace';
import { plural } from '@/shared/text';

// How far a system's description can be trusted: for each of its repos, whether the code has been read, at
// which commit, and how many facts point into it.

export interface RepoRow {
  readonly repo: string;
  readonly href: string;
  /** "Read at 7a8b9c0 on main, 3 May 2025", or that it has not been read. */
  readonly read: string;
  readonly scanned: boolean;
  /** "12 facts cite code here". */
  readonly cited: string;
}

const day = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

function citedLine(count: number): string {
  if (count === 0) return 'No fact cites its code yet';
  return `${plural(count, 'fact')} ${count === 1 ? 'cites' : 'cite'} its code`;
}

/** Each repo of one system (by its id, without `sys:`), with how fresh the reading of it is. */
export function reposOf(workspace: Workspace, today: SystemModel, system: string): RepoRow[] {
  const map = systemMapOf(workspace, today);
  const facts = [...map.facts.values()].filter((f) => f.sourcesOf === null);
  return map.repos
    .filter((r) => r.system === system)
    .map((r) => {
      const count = facts.filter((f) => f.sources.some((s) => s.repo === r.repo)).length;
      const branch = r.branch === null ? '' : ` on ${r.branch}`;
      const when = r.scannedAt === null ? '' : `, ${day(r.scannedAt)}`;
      return {
        repo: r.repo,
        href: `https://github.com/${r.repo}`,
        read:
          r.head === null
            ? 'Not scanned yet: what this page says comes from what people wrote'
            : `Read at ${r.head.slice(0, 7)}${branch}${when}`,
        scanned: r.head !== null,
        cited: citedLine(count),
      };
    });
}
