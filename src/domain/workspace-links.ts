import type { ConnectionKind, Domain, System } from './workspace';

/** What one system or domain calls, messages or reads in another, summed over their components. */
export interface Link {
  readonly from: string;
  readonly to: string;
  readonly via: readonly ConnectionKind[];
  /** How many component connections make up the link. */
  readonly count: number;
}

export interface Home {
  readonly domain: string;
  readonly system: string;
}

/** Where each component lives: component id to its domain and system. */
export function componentHomes(domains: readonly Domain[]): ReadonlyMap<string, Home> {
  return new Map(
    domains.flatMap((domain) =>
      domain.systems.flatMap((system) =>
        system.components.map((component) => [
          component.id,
          { domain: domain.id, system: system.id },
        ]),
      ),
    ),
  );
}

/** Every component connection, with the system it starts from. */
export interface Wire {
  readonly system: string;
  readonly component: string;
  readonly to: string;
  readonly via: ConnectionKind;
}

export function wiresOf(domains: readonly Domain[]): readonly Wire[] {
  return domains.flatMap((domain) => domain.systems.flatMap(systemWires));
}

function systemWires(system: System): readonly Wire[] {
  return system.components.flatMap((component) =>
    component.talksTo.map((connection) => ({
      system: system.id,
      component: component.id,
      to: connection.to,
      via: connection.via,
    })),
  );
}

/** One link per ordered pair of systems; connections inside one system are left out. */
export function systemLinks(domains: readonly Domain[]): readonly Link[] {
  const homes = componentHomes(domains);
  return gather(
    wiresOf(domains).flatMap((wire) => {
      const to = homes.get(wire.to)?.system;
      return to === undefined ? [] : [{ from: wire.system, to, via: wire.via }];
    }),
  );
}

/** The same, one level up: links between domains. */
export function domainLinks(domains: readonly Domain[]): readonly Link[] {
  const domainOf = new Map(
    domains.flatMap((domain) => domain.systems.map((system) => [system.id, domain.id])),
  );
  return gather(
    systemLinks(domains).flatMap((link) =>
      link.via.map((via, index) => ({
        from: domainOf.get(link.from) ?? link.from,
        to: domainOf.get(link.to) ?? link.to,
        via,
        weight: index === 0 ? link.count : 0,
      })),
    ),
  );
}

interface Pair {
  readonly from: string;
  readonly to: string;
  readonly via: ConnectionKind;
  readonly weight?: number;
}

function gather(pairs: readonly Pair[]): readonly Link[] {
  const links = new Map<
    string,
    { from: string; to: string; via: ConnectionKind[]; count: number }
  >();
  for (const pair of pairs) {
    if (pair.from === pair.to) continue;
    const key = `${pair.from}>${pair.to}`;
    const link = links.get(key) ?? { from: pair.from, to: pair.to, via: [], count: 0 };
    if (!link.via.includes(pair.via)) link.via.push(pair.via);
    link.count += pair.weight ?? 1;
    links.set(key, link);
  }
  return [...links.values()];
}
