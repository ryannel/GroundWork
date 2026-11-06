import { describe, expect, it } from 'vitest';

import { modelList, modelRecord } from '@/domain/workspace-model';

import type { MigrationFile } from './files';
import { migrationIdentities } from './identities';
import { fingerprint, migrationReview } from './review';
import { migrateWorkspace } from './workspace';

const source = {
  repo: 'example/provider',
  path: 'client.ts',
  commit: 'a'.repeat(40),
  lines: [2, 5],
};
const cite = `example-provider:client.ts@${'a'.repeat(40)}#L2-5`;
function fixture(): {
  readonly files: readonly MigrationFile[];
  readonly decision: Record<string, unknown>;
} {
  const components = [
    {
      id: 'svc:provider',
      type: 'external',
      name: 'Provider',
      does: 'Starts login',
      tech: 'HTTP',
      talks_to: [],
    },
    {
      id: 'svc:other-provider',
      type: 'external',
      name: 'Other name',
      does: 'Finishes login',
      tech: 'REST',
      talks_to: [],
    },
    { id: 'svc:provider', summary: 'Code uses a configured production host.', sources: [source] },
    {
      id: 'svc:other-provider',
      summary: 'The UAT host remains distinct.',
      sources: [{ ...source, lines: [7, 9] }],
    },
  ];
  const interfaces = [
    {
      id: 'if:provider',
      service: 'svc:provider',
      protocol: 'rest',
      summary: 'Passwordless',
      sources: [source],
      endpoints: [
        { id: 'api:start', sig: 'POST /login', summary: 'Starts login', sources: [source] },
      ],
    },
    {
      id: 'if:other-provider',
      service: 'svc:other-provider',
      protocol: 'rest',
      summary: 'Passwordless',
      sources: [source],
      endpoints: [
        { id: 'api:other-start', sig: 'POST /login', summary: 'Starts login', sources: [source] },
      ],
    },
  ];
  const files: MigrationFile[] = [
    { path: 'workspace.yaml', text: '', value: { id: 'example', name: 'Example' } },
    { path: 'domains/example/domain.yaml', text: '', value: { id: 'example', name: 'Example' } },
    ...['one', 'two'].flatMap((name, index) => [
      {
        path: `domains/example/systems/${name}/system.yaml`,
        text: '',
        value: { id: name, name, components: [components[index]] },
      },
      {
        path: `domains/example/systems/${name}/contracts.yaml`,
        text: '',
        value: { components: [components[index + 2]], interfaces: [interfaces[index]] },
      },
    ]),
  ];
  const sourceRecords = { components, interfaces };
  return {
    files,
    decision: {
      key: 'merge/provider',
      fingerprint: fingerprint(sourceRecords),
      status: 'accepted',
      source_records: sourceRecords,
      aliases: {
        'svc:provider': 'ext:provider',
        'svc:other-provider': 'ext:provider',
        'ext:other-provider': 'ext:provider',
        'if:other-provider': 'if:provider',
        'api:other-start': 'api:start',
      },
      canonical_external: {
        id: 'ext:provider',
        name: 'Provider',
        summary: [
          'Provider',
          'Other name',
          'Starts login',
          'Finishes login',
          'HTTP',
          'REST',
          'Code uses a configured production host.',
          'The UAT host remains distinct.',
        ].join('\n\n'),
        cites: [cite, `example-provider:client.ts@${'a'.repeat(40)}#L7-9`],
      },
      canonical_interface: {
        id: 'if:provider',
        summary: 'Passwordless',
        cites: [cite],
        kind: 'rest',
        external: 'ext:provider',
        entries: [
          {
            id: 'api:start',
            sig: 'POST /login',
            summary: 'Starts login',
            cites: [cite],
            method: 'POST',
            path: '/login',
          },
        ],
      },
    },
  };
}
function review(decision: Record<string, unknown>): ReturnType<typeof migrationReview> {
  return migrationReview([[decision]]);
}

describe('reviewed identity merges', () => {
  it('retains all eight original texts, cited facts and aliases while emitting one exact interface', () => {
    const { files, decision } = fixture();
    const before = JSON.stringify(files);
    const migrated = migrateWorkspace(files, review(decision));
    const externals = modelRecord(migrated.files.get('externals.yaml')?.value)?.externals;
    expect(externals).toEqual([decision.canonical_external]);
    const contracts = [...migrated.files.values()].filter(
      (value) => value.family === 'workspace' && value.definition === 'ContractsFile',
    );
    expect(contracts.flatMap((value) => modelList(modelRecord(value.value)?.interfaces))).toEqual([
      decision.canonical_interface,
    ]);
    expect(migrated.files.get('domains/example/systems/one/contracts.yaml')?.value).toMatchObject({
      interfaces: [decision.canonical_interface],
    });
    expect(modelRecord(migrated.files.get('aliases.yaml')?.value)).toMatchObject({
      'svc:other-provider': { to: 'ext:provider' },
      'ext:other-provider': { to: 'ext:provider' },
      'if:other-provider': { to: 'if:provider' },
      'api:other-start': { to: 'api:start' },
    });
    expect(
      migrateWorkspace(files.toReversed(), review(decision)).files.get('externals.yaml')?.value,
    ).toEqual({ externals });
    expect(JSON.stringify(files)).toBe(before);
  });
  it('does not merge unaccepted recipes and keeps declaration conflicts strict', () => {
    const { files, decision } = fixture();
    const unaccepted = migrationIdentities(files, review({ ...decision, status: 'proposed' }));
    expect(unaccepted.replacements.get('svc:other-provider')).toBe('ext:other-provider');
    expect(unaccepted.merges).toEqual([]);
  });
  it('rejects stale fingerprints and changed nested source facts', () => {
    const { files, decision } = fixture();
    expect(() => migrationIdentities(files, review({ ...decision, fingerprint: 'stale' }))).toThrow(
      'Stale acceptance',
    );
    const changed = structuredClone(files);
    const contract = modelRecord(
      changed.find((file) => file.path.endsWith('two/contracts.yaml'))?.value,
    );
    const endpoint = modelRecord(
      modelList(modelRecord(modelList(contract?.interfaces)[0])?.endpoints)[0],
    );
    if (endpoint === null) throw new Error('Fixture entry missing.');
    Object.assign(endpoint, { auth: 'New authorisation fact' });
    expect(() => migrationIdentities(changed, review(decision))).toThrow('source records');
  });
  it('rejects incomplete aliases, changed canonical records and overlapping recipes', () => {
    const { files, decision } = fixture();
    expect(() =>
      migrationIdentities(
        files,
        review({ ...decision, aliases: { 'svc:provider': 'ext:provider' } }),
      ),
    ).toThrow('complete alias map');
    expect(() =>
      migrationIdentities(
        files,
        review({
          ...decision,
          canonical_external: { ...modelRecord(decision.canonical_external), summary: 'Shortened' },
        }),
      ),
    ).toThrow('texts and citations');
    expect(() =>
      migrationIdentities(
        files,
        review({
          ...decision,
          canonical_interface: {
            ...modelRecord(decision.canonical_interface),
            summary: 'Different',
          },
        }),
      ),
    ).toThrow('canonical interface');
    expect(() =>
      migrationIdentities(
        files,
        migrationReview([[decision, { ...decision, key: 'merge/again' }]]),
      ),
    ).toThrow('Overlapping');
  });
  it('requires a matching complete source set and equal implementations', () => {
    const { files, decision } = fixture();
    const additional: MigrationFile = {
      path: 'domains/example/systems/three/contracts.yaml',
      text: '',
      value: {
        interfaces: [{ id: 'if:third', service: 'svc:provider', protocol: 'rest', endpoints: [] }],
      },
    };
    expect(() => migrationIdentities([...files, additional], review(decision))).toThrow(
      'source records',
    );
    const implemented: MigrationFile = {
      path: 'domains/example/systems/one/handlers.yaml',
      text: '',
      value: { handlers: [{ id: 'h:provider', component: 'svc:provider', on: 'api:start' }] },
    };
    expect(() => migrationIdentities([...files, implemented], review(decision))).toThrow(
      'implemented component',
    );
  });
});

it('accepts qualified placement additions without losing the original purpose or citations', () => {
  const component = {
    id: 'svc:unknown',
    type: 'external',
    name: 'Configured API',
    does: 'Looks up a record',
  };
  const files: MigrationFile[] = [
    { path: 'workspace.yaml', text: '', value: { id: 'example', name: 'Example' } },
    {
      path: 'domains/example/systems/one/system.yaml',
      text: '',
      value: { id: 'one', name: 'One', components: [component] },
    },
    {
      path: 'domains/example/systems/one/contracts.yaml',
      text: '',
      value: {
        components: [{ id: component.id, summary: 'Its operator is unknown.', sources: [source] }],
      },
    },
  ];
  const decision = {
    key: 'identity/svc:unknown',
    fingerprint: fingerprint(component),
    status: 'accepted',
    kind: 'system',
    proposed_id: 'sys:unmapped-boundary',
    purpose:
      'Looks up a record\n\nIts operator is unknown.\n\nPlacement does not establish company ownership.',
  };
  const migrated = migrateWorkspace(files, review(decision));
  expect(
    migrated.files.get('domains/example/systems/unmapped-boundary/system.yaml')?.value,
  ).toMatchObject({
    id: 'sys:unmapped-boundary',
    mapped: false,
    purpose: decision.purpose,
    cites: [cite],
  });
  expect(() =>
    migrateWorkspace(files, review({ ...decision, purpose: 'Operator unknown' })),
  ).toThrow('drops facts');
  expect(() => migrateWorkspace(files, review({ ...decision, kind: 'invented' }))).toThrow(
    'Invalid accepted identity kind',
  );
  expect(() => migrateWorkspace(files, review({ ...decision, proposed_id: 'ext:wrong' }))).toThrow(
    'Invalid accepted identity target',
  );
});
