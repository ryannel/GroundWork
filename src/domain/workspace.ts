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
  readonly talksTo: readonly Connection[];
}

export interface System {
  readonly id: string;
  readonly name: string;
  /** What the system is for, in a sentence; when absent its components say. */
  readonly purpose?: string | null;
  readonly team: string | null;
  readonly repos: readonly string[];
  readonly components: readonly Component[];
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
