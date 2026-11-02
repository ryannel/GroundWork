import type { ExplorerManifest, ExplorerPage } from '@/domain/service-explorer';

export function explorerFixture(): ExplorerPage {
  const sourceIds = ['source:fixture'];
  return {
    format: 'service-explorer-page/v1',
    snapshot: 'fixture-snapshot',
    kind: 'flow',
    title: 'Update customer',
    description: 'Synthetic test evidence.',
    nodes: [
      {
        id: 'entry',
        label: 'Update customer',
        detail: 'HTTP request',
        kind: 'entry',
        sourceIds,
        target: null,
      },
      {
        id: 'guard',
        label: 'Known individual?',
        detail: 'Source guard',
        kind: 'branch',
        sourceIds,
        target: null,
      },
      {
        id: 'save',
        label: 'Save customer',
        detail: 'Source write',
        kind: 'storage',
        sourceIds,
        target: 'data.json',
      },
      {
        id: 'failure',
        label: 'Return 404',
        detail: 'Missing individual',
        kind: 'failure',
        sourceIds,
        target: null,
      },
      {
        id: 'async',
        label: 'Publish customer event',
        detail: 'Declared continuation',
        kind: 'async',
        sourceIds,
        target: null,
      },
    ],
    links: [
      { id: 'begin', from: 'entry', to: 'guard', label: 'check', kind: 'control', sourceIds },
      { id: 'yes', from: 'guard', to: 'save', label: 'yes', kind: 'branch', sourceIds },
      { id: 'no', from: 'guard', to: 'failure', label: 'no', kind: 'failure', sourceIds },
      { id: 'later', from: 'save', to: 'async', label: 'async', kind: 'async', sourceIds },
    ],
    fields: [],
    sources: [
      {
        id: sourceIds[0] ?? '',
        label: 'Synthetic fixture source',
        url: 'https://github.com/example/service/blob/fixture/Source.java#L1-L20',
      },
    ],
    gaps: ['Runtime activation unverified'],
    completeSelection: true,
  };
}
export function explorerManifestFixture(
  artifacts: ExplorerManifest['artifacts'],
): ExplorerManifest {
  return {
    format: 'service-explorer/v1',
    workspace: 'acme',
    snapshot: 'fixture-snapshot',
    artifacts,
    services: [
      {
        id: 'component:fixture',
        name: 'Customer service',
        repo: 'example/service',
        commit: 'a'.repeat(40),
        purpose: {
          label: 'Inferred',
          statement: 'Keeps customer profiles',
          confidence: 'medium',
          claim: 'purpose:fixture',
        },
        overview: 'flow.json',
        callers: 'flow.json',
        entries: [{ id: 'entry', label: 'PUT customer', file: 'flow.json' }],
      },
    ],
  };
}
