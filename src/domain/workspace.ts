// A workspace holds domains; a domain holds systems; a system holds components.
// One word per idea: these four are the only levels.

export type ComponentType =
  'service' | 'website' | 'database' | 'queue' | 'job' | 'library' | 'external';
export type ConnectionKind = 'api' | 'message' | 'data';

export interface Connection {
  readonly to: string;
  readonly via: ConnectionKind;
}

export interface Component {
  readonly id: string;
  readonly name: string;
  readonly type: ComponentType;
  readonly tech: string | null;
  readonly does: string | null;
  /** Plumbing every system leans on and no business data comes from: feature flags, sign-in, error tracking. */
  readonly infrastructure?: boolean;
  readonly talksTo: readonly Connection[];
}

export const SYSTEM_TIERS = ['channel', 'gateway', 'forward', 'backend', 'upstream'] as const;

/**
 * Where a system sits in the path a request takes: in through a channel, across the gateway, to the forward-facing
 * systems that answer it, the back end they rely on, and the upstream sources
 * the data comes from.
 */
export type SystemTier = (typeof SYSTEM_TIERS)[number];

export interface System {
  readonly id: string;
  readonly name: string;
  /** What the system is for, in a sentence; when absent its components say. */
  readonly purpose?: string | null;
  /** The tier a person put the system in; when absent the map works it out. */
  readonly tier?: SystemTier | null;
  readonly team: string | null;
  readonly repos: readonly CodeHome[];
  readonly components: readonly Component[];
}

/** Where a system's code lives: a whole repo, or one folder of it when several systems share the repo. */
export interface CodeHome {
  readonly repo: string;
  /** The folder inside the repo, with no slash at either end; null for the whole repo. */
  readonly path: string | null;
}

/** `org/name`, or `org/name/folder` when the system holds one folder of the repo. */
export function homeLabel(home: CodeHome): string {
  return home.path === null ? home.repo : `${home.repo}/${home.path}`;
}

function holds(home: CodeHome, repo: string, file: string): boolean {
  if (home.repo !== repo) return false;
  return home.path === null || file === home.path || file.startsWith(`${home.path}/`);
}

/**
 * The system a file of a repo belongs to, and the home that places it there. When systems share a repo, the
 * deepest folder that holds the file wins, as in CODEOWNERS; a system that lists the whole repo takes the rest.
 */
export function homeOf(
  workspace: Workspace,
  repo: string,
  file: string,
): { readonly system: string; readonly home: CodeHome } | null {
  const depth = (home: CodeHome): number => home.path?.length ?? -1;
  const holders = systemsOf(workspace).flatMap((system) =>
    system.repos
      .filter((home) => holds(home, repo, file))
      .map((home) => ({ system: system.id, home })),
  );
  return holders.reduce<(typeof holders)[number] | null>(
    (best, each) => (best === null || depth(each.home) > depth(best.home) ? each : best),
    null,
  );
}

/** The repos a system's code is in, each once, whether it holds all of a repo or folders of it. */
export function repoNamesOf(system: System): readonly string[] {
  return [...new Set(system.repos.map((home) => home.repo))];
}

export interface Domain {
  readonly id: string;
  readonly name: string;
  readonly purpose: string | null;
  readonly systems: readonly System[];
}

export interface Team {
  readonly id: string;
  readonly name: string;
  /** One of the team hues, 1 to 13. */
  readonly colour: number | null;
  /** Where to reach the team, such as a chat channel. */
  readonly channel: string | null;
}

/** Someone outside the systems who uses them: a shopper, a category manager, warehouse staff. */
export interface Actor {
  readonly id: string;
  readonly name: string;
  /** Who they are, in a line. */
  readonly summary: string | null;
  /** The components they use, beyond those the flows they start already show. */
  readonly uses: readonly string[];
  /** Whether they are the customer, whom the whole workspace serves: drawn apart on the map, not in a domain. */
  readonly customer: boolean;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPrivate: boolean;
  readonly teams: readonly Team[];
  readonly actors: readonly Actor[];
  readonly domains: readonly Domain[];
  /** The journeys a person picked to lead the workspace, by user journey or flow id; none and the code suggests them. */
  readonly keyJourneys?: readonly string[];
}

export function systemsOf(workspace: Workspace): readonly System[] {
  return workspace.domains.flatMap((domain) => domain.systems);
}

export function componentsOf(workspace: Workspace): readonly Component[] {
  return systemsOf(workspace).flatMap((system) => system.components);
}

/** What a system is for: its purpose, else the words of its namesake component, or of its first own component that says. */
export function systemDoes(system: System): string {
  if (system.purpose !== undefined && system.purpose !== null) return system.purpose;
  const says = system.components.filter((c) => c.type !== 'external' && c.does !== null);
  const lead = says.find((c) => c.name === system.name) ?? says.find((c) => c.type === 'service');
  return (lead ?? says[0])?.does ?? '';
}
