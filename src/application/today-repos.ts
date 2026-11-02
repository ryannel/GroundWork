import { type MapFact, systemMapOf } from '@/application/system-map';
import type { SystemModel } from '@/application/workspace-model';
import { type CodeHome, homeLabel, homeOf, type Workspace } from '@/domain/workspace';
import type { ScanCheck } from '@/domain/workspace-model';
import { plural } from '@/shared/text';

// How far a system's description can be trusted: for each of its repos, whether the code has been read, at
// which commit, and how many facts point into it.

export interface RepoRow {
  /** `org/name`, or `org/name/folder` when the system holds one folder of a shared repo. */
  readonly repo: string;
  readonly href: string;
  /** "Read at 7a8b9c0 on main, 3 May 2025", or that it has not been read. */
  readonly read: string;
  readonly scanned: boolean;
  /** "12 commits behind, checked 21 October 2025", or null when nobody has checked the remote since the scan. */
  readonly moved: string | null;
  /** "12 facts cite code here". */
  readonly cited: string;
}

const day = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** How far the branch had moved past the commit the scan read, when tools/scan-status.ts last looked. */
function movedLine(
  head: string | null,
  checked: ScanCheck | null,
  path: string | null,
): string | null {
  if (head === null || checked === null) return null;
  const when = `checked ${day(checked.at)}`;
  if (checked.tip === head) return `Up to date, ${when}`;
  const touched = path === null ? undefined : checked.folders[path];
  if (touched !== undefined) return folderLine(touched, checked.behind, when);
  if (checked.behind === null) return `The code has moved on since, ${when}`;
  return `${plural(checked.behind, 'commit')} behind, ${when}`;
}

// A shared repo moves for everyone; what matters to one system is whether its own folder changed.
function folderLine(touched: number, behind: number | null, when: string): string {
  const since = behind === null ? 'the commits since' : `the ${plural(behind, 'commit')} since`;
  if (touched === 0) return `Up to date: none of ${since} touch this folder, ${when}`;
  return `${String(touched)} of ${since} ${touched === 1 ? 'touches' : 'touch'} this folder, ${when}`;
}

function citedLine(count: number): string {
  if (count === 0) return 'No fact cites its code yet';
  return `${plural(count, 'fact')} ${count === 1 ? 'cites' : 'cite'} its code`;
}

function hrefOf({ repo, path }: CodeHome): string {
  const base = `https://github.com/${repo}`;
  return path === null ? base : `${base}/tree/HEAD/${path}`;
}

function citedCounts(
  workspace: Workspace,
  facts: readonly MapFact[],
  system: string,
): ReadonlyMap<string, number> {
  const homes = new Map<string, ReturnType<typeof homeOf>>();
  const counts = new Map<string, number>();
  for (const fact of facts) {
    const cited = new Set<string>();
    for (const source of fact.sources) {
      const key = `${source.repo}\n${source.path}`;
      let home = homes.get(key);
      if (home === undefined) {
        home = homeOf(workspace, source.repo, source.path);
        homes.set(key, home);
      }
      if (home?.system === system) cited.add(homeLabel(home.home));
    }
    for (const home of cited) counts.set(home, (counts.get(home) ?? 0) + 1);
  }
  return counts;
}

/** Each repo (or folder of one) of one system (by its id, without `sys:`), with how fresh the reading of it is. */
export function reposOf(workspace: Workspace, today: SystemModel, system: string): RepoRow[] {
  const map = systemMapOf(workspace, today);
  const facts = [...map.facts.values()].filter((f) => f.sourcesOf === null);
  const counts = citedCounts(workspace, facts, system);
  return map.repos
    .filter((r) => r.system === system)
    .map((r) => {
      const home: CodeHome = { repo: r.repo, path: r.path };
      const count = counts.get(homeLabel(home)) ?? 0;
      const branch = r.branch === null ? '' : ` on ${r.branch}`;
      const when = r.scannedAt === null ? '' : `, ${day(r.scannedAt)}`;
      const unrecorded =
        count === 0
          ? 'Not scanned yet: what this page says comes from what people wrote'
          : 'Code cited; no completed scan recorded';
      return {
        repo: homeLabel(home),
        href: hrefOf(home),
        read: r.head === null ? unrecorded : `Read at ${r.head.slice(0, 7)}${branch}${when}`,
        scanned: r.head !== null,
        moved: movedLine(r.head, r.checked, r.path),
        cited: citedLine(count),
      };
    });
}
