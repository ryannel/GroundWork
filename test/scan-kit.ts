import type { ScanDocument } from '@/domain/scan/scan.generated';

export function scanFixture(): ScanDocument {
  return {
    format: 'scan/v1',
    id: 'scan:fixture',
    sources: [
      {
        kind: 'source',
        id: 'source:handler',
        repo: 'fixture/repo',
        path: 'handler.ts',
        commit: 'pinned',
        blob: 'blob',
        lines: [1, 3],
        host: 'host:server',
        authority: 'declared',
      },
    ],
    hosts: [
      {
        kind: 'host',
        id: 'host:server',
        component: 'component:server',
        environment: 'server',
        support: ['source:handler'],
      },
    ],
    rules: [],
    derivations: [],
    gaps: [
      {
        kind: 'gap',
        id: 'gap:unknown',
        reason: 'unsupported',
        description: 'Unsupported fixture operation',
      },
    ],
    obligations: [],
    receipts: [],
    contracts: [],
    effects: [],
    summaries: [],
    actors: [],
    surfaces: [],
    controls: [],
    actions: [],
    outcomes: [],
    executions: [],
    journeys: [],
    dependencies: [],
    closures: [],
  };
}
