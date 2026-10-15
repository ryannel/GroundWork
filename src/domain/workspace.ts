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
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPrivate: boolean;
  readonly teams: readonly Team[];
  readonly domains: readonly Domain[];
}

export function systemsOf(workspace: Workspace): readonly System[] {
  return workspace.domains.flatMap((domain) => domain.systems);
}

export function componentsOf(workspace: Workspace): readonly Component[] {
  return systemsOf(workspace).flatMap((system) => system.components);
}
