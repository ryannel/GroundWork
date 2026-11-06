import { describe, expect, it, vi } from 'vitest';

import { modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { convertCitations, migrationCitations } from './citations';
import { detailIndex, migrateComponent } from './components';
import { fieldsOf, migrateContracts, taggedType } from './contracts';
import { modelYaml, rewriteDocument } from './files';
import { migrationIdentities, migrationJobIdentities } from './identities';
import { migrationReview, reviewSummary } from './review';

vi.mock(import('server-only'), () => ({}));

const source = {
  repo: 'example/orders',
  path: 'src/Orders.ts',
  commit: 'a'.repeat(40),
  lines: [3, 8],
};
describe('migration of authored contracts', () => {
  it('retains exact code locations, expands Git-host links and preserves source notes for review', () => {
    const review = migrationReview();
    const citations = migrationCitations([], review, 'sys:orders');
    expect(
      citations.convert({
        sources: [
          source,
          {
            url: 'https://github.com/example/orders/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/src/Orders.ts#L3-L8',
            note: 'Route binding',
          },
        ],
      }),
    ).toEqual(['example-orders:src/Orders.ts@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#L3-8']);
    expect(citations.homes()).toEqual({ 'example-orders': { repo: 'example/orders' } });
    expect(review.rows()['source-notes']).toHaveLength(1);
    expect(
      convertCitations(
        { sources: [source], origin: 'extracted', nested: { sources: [source] } },
        citations,
      ),
    ).toEqual({
      cites: citations.convert({ sources: [source] }),
      nested: { cites: citations.convert({ sources: [source] }) },
    });
    const yaml = modelYaml({ cites: citations.convert({ sources: [source] }) });
    expect(yaml.trim().split('\n')).toHaveLength(1);
  });
  it('places global details with their declared component and retains differing descriptions', async () => {
    const review = migrationReview();
    const citations = migrationCitations([], review, 'sys:orders');
    const details = detailIndex([
      {
        value: { components: [{ id: 'svc:orders', summary: 'Cited detail.', sources: [source] }] },
      },
    ]);
    const component = migrateComponent(
      { id: 'svc:orders', name: 'Orders', type: 'service', does: 'Short purpose.' },
      details.get('svc:orders') ?? [],
      citations,
      review,
    );
    expect(component).toMatchObject({ kind: 'service', does: 'Short purpose.\n\nCited detail.' });
    const validate = await modelValidator('workspace', 'Component');
    expect(validate(component), JSON.stringify(validate.errors)).toBe(true);
  });
  it('preserves endpoint qualifications, field notes and nested tagged types', async () => {
    const review = migrationReview();
    const citations = migrationCitations([], review, 'sys:orders');
    const file = migrateContracts(
      {
        interfaces: [
          {
            id: 'if:orders',
            service: 'svc:orders',
            protocol: 'rest',
            endpoints: [
              {
                id: 'api:get',
                sig: 'GET /orders',
                auth: 'token',
                idempotent: true,
                summary: 'Reads orders.',
                errors: [{ status: 404, code: 'MISSING', when: 'absent' }],
              },
            ],
          },
        ],
        schemas: [
          {
            id: 'sch:order',
            kind: 'dto',
            fields: [{ name: 'labels', type: 'Map<string,List<string>>', note: 'Market labels' }],
          },
        ],
      },
      { citations, review },
    );
    const validate = await modelValidator('workspace', 'ContractsFile');
    expect(validate(file), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(file)).toContain('Market labels');
    expect(file).toMatchObject({
      interfaces: [{ entries: [{ errors: [{ status: 404, when: 'absent · Code: "MISSING"' }] }] }],
    });
    expect(taggedType('Map<string,List<string>>')).toEqual({
      map: { key: 'string', value: { array: 'string' } },
    });
    expect(fieldsOf([{ name: 'status', type: 'enum(active, inactive)' }])).toEqual([
      { id: 'status', name: 'status', type: { enum: ['active', 'inactive'] } },
    ]);
  });
  it('rewrites reference keys only when requested and leaves evidence field names intact', () => {
    const replacements = new Map([
      ['evidence', 'ev:original'],
      ['file:a', 'ev:file'],
    ]);
    expect(rewriteDocument({ evidence: ['file:a'], id: 'evidence' }, replacements, false)).toEqual({
      evidence: ['ev:file'],
      id: 'ev:original',
    });
    expect(rewriteDocument({ 'file:a': 'file:a' }, replacements)).toEqual({ 'ev:file': 'ev:file' });
  });
  it('keeps uncertain legacy externals explicit in review and accepts a pinned classification', () => {
    const files = [
      {
        path: 'domains/example/systems/orders/system.yaml',
        text: '',
        value: {
          id: 'orders',
          components: [
            { id: 'svc:unknown', type: 'external', name: 'Unknown' },
            { id: 'svc:shop', type: 'website', name: 'Shop' },
            { id: 'st:events', type: 'queue', name: 'Events' },
          ],
        },
      },
    ];
    const review = migrationReview();
    const initial = migrationIdentities(files, review);
    expect(initial.replacements.get('svc:shop')).toBe('app:shop');
    expect(initial.replacements.get('st:events')).toBe('top:events');
    expect(review.pending('identities')).toBe(1);
    const accepted = (review.rows().identities ?? []).map((row) => ({
      ...row,
      status: 'accepted',
      kind: 'system',
    }));
    const final = migrationIdentities(files, migrationReview([accepted]));
    expect(final.replacements.get('svc:unknown')).toBe('sys:unknown');
    expect(modelRecord(reviewSummary(review.rows()).families)?.identities).toEqual({
      total: 1,
      pending: 1,
    });
  });
});

it('keeps schema property names and words when a bare system id has the same spelling', () => {
  const replacements = new Map([['operations', 'sys:operations']]);
  expect(
    rewriteDocument(
      {
        operations: [{ id: 'gql:example', name: 'operations' }],
        system: 'operations',
        description: 'See [[operations]].',
        default: 'operations',
      },
      replacements,
    ),
  ).toEqual({
    operations: [{ id: 'gql:example', name: 'operations' }],
    system: 'sys:operations',
    description: 'See [[sys:operations]].',
    default: 'operations',
  });
});

it('retains the two explicit successors of an ambiguous bare domain and area id', () => {
  const files = [
    { path: 'domains/fleet/domain.yaml', text: '', value: { id: 'fleet', name: 'Fleet' } },
    { path: 'landscape.yaml', text: '', value: { areas: [{ id: 'fleet', name: 'Fleet' }] } },
  ];
  const ids = migrationIdentities(files, migrationReview());
  expect(ids.replacements.has('fleet')).toBe(false);
  expect(ids.ambiguous.get('fleet')).toEqual(['dom:fleet', 'area:fleet']);
});

it('keeps distinct field names and rewrites retired child ids across documents', () => {
  const files = [
    {
      path: 'domains/orders/systems/orders/contracts.yaml',
      text: '',
      value: {
        schemas: [
          {
            id: 'sch:task',
            fields: [
              { name: '_id', type: 'string' },
              { name: 'id', type: 'string' },
            ],
          },
        ],
      },
    },
  ];
  const identities = migrationIdentities(files, migrationReview());
  expect(fieldsOf([{ name: '_id' }, { name: 'id' }]).map((field) => field.id)).toEqual([
    'field-id',
    'id',
  ]);
  expect(
    rewriteDocument(
      { set: { note: 'See [[sch:task#_id]].' }, modify: 'sch:task#_id' },
      identities.replacements,
    ),
  ).toEqual({ set: { note: 'See [[sch:task#field-id]].' }, modify: 'sch:task#field-id' });
});
it('aliases unique job labels and leaves shared labels explicitly ambiguous', () => {
  const files = [
    {
      path: 'domains/orders/systems/orders/handlers.yaml',
      text: '',
      value: {
        handlers: [
          { id: 'h:daily', on: 'job:each morning' },
          { id: 'h:one', on: 'job:heartbeat' },
          { id: 'h:two', on: 'job:heartbeat' },
        ],
      },
    },
  ];
  const jobs = migrationJobIdentities(files);
  expect(jobs.replacements.get('job:each morning')).toBe('job:daily');
  expect(jobs.aliases['job:heartbeat']?.to).toBeNull();
  expect(jobs.replacements.has('job:heartbeat')).toBe(false);
  expect(
    rewriteDocument(
      { on: 'job:each morning', description: 'See [[job:each morning]].', trigger: 'each morning' },
      jobs.replacements,
    ),
  ).toEqual({ on: 'job:daily', description: 'See [[job:daily]].', trigger: 'each morning' });
});

it('assigns an app id to an explicitly proposed UI component and rewrites later plan references', () => {
  const files = [
    {
      path: 'plans/care/plan.yaml',
      text: '',
      value: {
        meta: { id: 'care' },
        changes: [
          {
            ops: [
              { add: 'service', value: { id: 'svc:sales-tool', kind: 'ui', system: 'sys:sales' } },
              { modify: 'svc:sales-tool', set: { does: 'Prices an offer' } },
            ],
          },
        ],
      },
    },
  ];
  const identities = migrationIdentities(files, migrationReview());
  expect(identities.replacements.get('svc:sales-tool')).toBe('app:sales-tool');
  expect(
    rewriteDocument(
      { modify: 'svc:sales-tool', note: 'Use [[svc:sales-tool]].' },
      identities.replacements,
    ),
  ).toEqual({ modify: 'app:sales-tool', note: 'Use [[app:sales-tool]].' });
});

it('retains a known system provider, protocol metadata and exact client evidence', async () => {
  const review = migrationReview();
  const result = migrateContracts(
    {
      interfaces: [
        {
          id: 'if:boundary',
          service: 'sys:unmapped',
          protocol: 'https',
          sources: [source],
          endpoints: [{ id: 'api:known', sig: 'GET /known', sources: [source] }],
        },
      ],
    },
    { review, citations: migrationCitations([], review, 'sys:consumer') },
  );
  const check = await modelValidator('workspace', 'ContractsFile');
  expect(check(result), JSON.stringify(check.errors)).toBe(true);
  expect(result.interfaces).toEqual([
    {
      id: 'if:boundary',
      system: 'sys:unmapped',
      kind: 'rest',
      transport: 'https',
      cites: [`example-orders:src/Orders.ts@${source.commit}#L3-8`],
      entries: [
        {
          id: 'api:known',
          sig: 'GET /known',
          method: 'GET',
          path: '/known',
          cites: [`example-orders:src/Orders.ts@${source.commit}#L3-8`],
        },
      ],
    },
  ]);
});
