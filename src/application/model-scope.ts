import { componentsOf, type Workspace } from '@/domain/workspace';

// What part of the workspace a page teaches. The model stays whole, so calls, messages and journeys that
// cross the edge stay true; a scope only says which components are in view. The map keeps the ones they
// talk to readable and leaves the rest out; catalogues keep what the components in view own.

export interface ModelScope {
  readonly kind: 'workspace' | 'domain' | 'system';
  /** The domain or system id; the workspace id for the whole. */
  readonly id: string;
  readonly name: string;
  /** Component ids in view, and the `sys:<id>` of each system in view. */
  readonly focus: ReadonlySet<string>;
}

const systemKey = (id: string): string => `sys:${id}`;

export function workspaceScopeOf(workspace: Workspace): ModelScope {
  const systems = workspace.domains.flatMap((domain) => domain.systems);
  return {
    kind: 'workspace',
    id: workspace.id,
    name: workspace.name,
    focus: new Set([
      ...systems.map((system) => systemKey(system.id)),
      ...componentsOf(workspace).map((component) => component.id),
    ]),
  };
}

export function domainScopeOf(workspace: Workspace, id: string): ModelScope | null {
  const domain = workspace.domains.find((each) => each.id === id);
  if (domain === undefined) return null;
  return {
    kind: 'domain',
    id,
    name: domain.name,
    focus: new Set(
      domain.systems.flatMap((system) => [
        systemKey(system.id),
        ...system.components.map((component) => component.id),
      ]),
    ),
  };
}

export function systemScopeOf(workspace: Workspace, id: string): ModelScope | null {
  const system = workspace.domains.flatMap((domain) => domain.systems).find((s) => s.id === id);
  if (system === undefined) return null;
  return {
    kind: 'system',
    id,
    name: system.name,
    focus: new Set([systemKey(id), ...system.components.map((component) => component.id)]),
  };
}
