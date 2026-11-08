import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  candidateRows,
  consumerInventory,
  inventoryReview,
  readInventorySource,
  sourceHash,
  usesCanonicalModel,
  type Candidate,
  type Disposition,
} from './consumer-inventory';

vi.mock(import('server-only'), () => ({}));

const candidate = (file: string, category = 'consumer'): Candidate => ({
  file,
  category,
  hits: [{ line: 1, text: 'Original candidate evidence' }],
});
const proofFile = 'artifacts/rebuild/pr8/native-proof.json';
const proof = '{"nativeContract":"passed"}';
function review(file: string, source: string, role: Disposition['role'] = 'consumer'): Disposition {
  return {
    file,
    sourceSha256: sourceHash(source),
    role,
    status: 'migrated',
    reason: 'The exact native contract is proven.',
    evidence: [{ file, line: 1, text: source.split('\n')[0] ?? '' }],
    proofs: [{ file: proofFile, sha256: sourceHash(proof) }],
    ...(role === 'producer' ? { stage: 9 } : {}),
    ...(role === 'retirement' ? { stage: 10 } : {}),
  };
}
function files(file: string, source: string): Map<string, string> {
  return new Map([
    [file, source],
    [proofFile, proof],
  ]);
}

describe('the reviewed model consumer inventory', () => {
  it('preserves every original candidate and fresh discovery without inventing migration status', () => {
    const old = candidate('src/application/old.ts');
    const fresh = candidate('src/application/native.ts');
    const result = consumerInventory(
      [old],
      [fresh],
      [],
      new Map([
        [old.file, 'export const unchanged = 1;'],
        [fresh.file, 'export const canonical = 1;'],
      ]),
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.find((row) => row.file === old.file)?.original).toEqual(old);
    expect(result.candidates.find((row) => row.file === fresh.file)?.original).toBeNull();
    expect(result.consumers.every((row) => row.status === 'adapter')).toBe(true);
  });
  it('separates historical documentation, tests and command wrappers without claiming migration', () => {
    const rows = [
      candidate('docs/scan-trials/old.md', 'documentation'),
      candidate('src/example.test.ts', 'fixture or test'),
      candidate('package.json#scripts/map', 'package script'),
    ];
    const result = consumerInventory(rows, rows, [], new Map());
    expect(result.consumers).toEqual([]);
    expect(result.candidates.map((row) => [row.role, row.status])).toEqual([
      ['documentation', 'reference'],
      ['command', 'reference'],
      ['fixture or test', 'reference'],
    ]);
    expect(result.candidates.every((row) => row.original !== null)).toBe(true);
  });
  it('accepts only a complete current source and proof, including exact evidence lines', () => {
    const file = 'src/application/native.ts';
    const source = 'export const native = true;';
    const rows = [candidate(file)];
    const accepted = review(file, source);
    expect(
      consumerInventory(rows, rows, [accepted], files(file, source)).consumers[0]?.status,
    ).toBe('migrated');
    for (const changed of [
      files(file, `${source}\n// changed`),
      new Map([[file, source]]),
      new Map([
        [file, source],
        [proofFile, 'changed proof'],
      ]),
    ]) {
      const result = consumerInventory(rows, rows, [accepted], changed);
      expect(result.consumers[0]?.status).toBe('adapter');
      expect(result.issues).toHaveLength(1);
    }
    const moved = { ...accepted, evidence: [{ file, line: 2, text: source }] };
    expect(consumerInventory(rows, rows, [moved], files(file, source)).consumers[0]?.status).toBe(
      'adapter',
    );
  });
  it('does not clear a still-used legacy reader even when the claim and proof hashes are current', () => {
    const file = 'tools/example.ts';
    const source =
      "import { derive as build } from '@/application/plan/derive';\nexport const result = build({});";
    const rows = [candidate(file, 'tool')];
    const result = consumerInventory(rows, rows, [review(file, source)], files(file, source));
    expect(result.consumers[0]?.status).toBe('adapter');
    expect(result.consumers[0]?.legacyUses).toEqual([
      { name: 'build', line: 2, text: 'export const result = build({});' },
    ]);
  });
  it('keeps proven producers pending PR9 and rejects retirement while a live route imports it', () => {
    const file = 'tools/producer.ts';
    const source = 'export const writes = true;';
    const rows = [candidate(file, 'tool')];
    const data = files(file, source);
    const producer = consumerInventory(rows, rows, [review(file, source, 'producer')], data);
    expect(producer.consumers).toEqual([]);
    expect(producer.pending[0]).toMatchObject({ role: 'producer', status: 'pending', stage: 9 });
    const legacy =
      "import { derive } from '@/application/plan/derive';\nexport const writes = derive({});";
    data.set(file, legacy);
    const old = review(file, legacy, 'retirement');
    expect(consumerInventory(rows, rows, [old], data).pending[0]).toMatchObject({
      stage: 10,
      status: 'pending',
    });
    data.set('src/app/page.tsx', "import '@/../tools/producer';");
    const active = consumerInventory(rows, rows, [old], data);
    expect(active.consumers[0]?.status).toBe('adapter');
    expect(active.issues).toContain(
      `${file}: A live runtime model dependency still reaches this proposed retirement.`,
    );
  });
  it('requires real absence and a replacement proof before recording deletion', () => {
    const file = 'src/application/old.ts';
    const replacement = 'src/application/native.ts';
    const source = 'export const native = true;';
    const rows = [candidate(file)];
    const disposition: Disposition = {
      ...review(replacement, source),
      file,
      sourceSha256: null,
      status: 'deleted',
    };
    const data = files(replacement, source);
    expect(consumerInventory(rows, [], [disposition], data).consumers[0]?.status).toBe('deleted');
    const retirement = consumerInventory(
      rows,
      [],
      [{ ...disposition, role: 'retirement', stage: 10 }],
      data,
    );
    expect(retirement.candidates[0]?.status).toBe('deleted');
    expect(retirement.pending).toEqual([]);
    expect(retirement.issues).toEqual([]);
    data.set(file, 'The old source still exists.');
    expect(consumerInventory(rows, [], [disposition], data).consumers[0]?.status).toBe('adapter');
  });
  it('rejects unknown, duplicated or malformed review records instead of hiding them', () => {
    const file = 'src/application/native.ts';
    const source = 'export const native = true;';
    const accepted = review(file, source);
    expect(consumerInventory([], [], [accepted], files(file, source)).issues).toEqual([
      `Unknown reviewed candidate: ${file}`,
    ]);
    expect(() =>
      consumerInventory([candidate(file)], [], [accepted, accepted], files(file, source)),
    ).toThrow('Repeated consumer inventory file identity.');
    expect(() => inventoryReview({ format: 1, original: {}, dispositions: [] })).toThrow(
      'Inventory metadata requires file.',
    );
    expect(() => candidateRows({ rows: [] })).toThrow('Inventory metadata requires an array.');
    const original = { ...candidate(file), status: 'adapter', extraOriginalEvidence: 'kept' };
    expect(candidateRows([original])).toEqual([original]);
  });
});

it('reads complete review metadata and rejects unknown roles, statuses and malformed evidence', () => {
  const file = 'src/application/native.ts';
  const disposition = review(file, 'export const native = true;');
  const metadata = {
    format: 1,
    original: { file: 'original.json', sha256: 'recorded', rows: 1 },
    dispositions: [disposition],
  };
  expect(inventoryReview(metadata)).toEqual({
    original: metadata.original,
    dispositions: metadata.dispositions,
  });
  const invalid = [
    { value: { ...metadata, format: 2 }, message: 'Unknown inventory review format.' },
    {
      value: { ...metadata, dispositions: [{ ...disposition, role: 'unknown' }] },
      message: 'Unknown reviewed inventory role or status.',
    },
    {
      value: { ...metadata, dispositions: [{ ...disposition, status: 'assumed' }] },
      message: 'Unknown reviewed inventory role or status.',
    },
    {
      value: { ...metadata, dispositions: [{ ...disposition, stage: 8 }] },
      message: 'Unknown rebuild stage.',
    },
    {
      value: { ...metadata, dispositions: [{ ...disposition, sourceSha256: 5 }] },
      message: 'A review must bind the complete current source hash or its absence.',
    },
    {
      value: {
        ...metadata,
        dispositions: [{ ...disposition, evidence: [{ file, line: 0, text: 'invalid' }] }],
      },
      message: 'Inventory metadata requires a positive line.',
    },
  ];
  for (const entry of invalid) expect(() => inventoryReview(entry.value)).toThrow(entry.message);
});

it('keeps producer deferral and deletion claims from clearing active or present consumers', () => {
  const file = 'tools/old.ts';
  const source =
    "import { derive } from '@/application/plan/derive';\nexport const output = derive({});";
  const rows = [candidate(file, 'tool')];
  const data = files(file, source);
  expect(
    consumerInventory(rows, rows, [review(file, source, 'producer')], data).consumers[0]?.status,
  ).toBe('adapter');
  const existingDelete = { ...review(file, source), status: 'deleted' };
  const parsed = inventoryReview({
    format: 1,
    original: { file: 'original.json', sha256: 'recorded', rows: 1 },
    dispositions: [existingDelete],
  });
  expect(consumerInventory(rows, rows, parsed.dispositions, data).issues).toContain(
    `${file}: The claimed deleted file still exists.`,
  );
});

it('follows literal lazy imports and re-exports when checking a retirement claim', () => {
  const file = 'src/application/old.ts';
  const source =
    "import { derive } from '@/application/plan/derive';\nexport const legacy = derive({});";
  const rows = [candidate(file)];
  for (const entry of [
    "export { legacy } from '@/application/old';",
    "export const load = () => import('@/application/old');",
  ]) {
    const data = files(file, source);
    data.set('src/app/page.tsx', entry);
    expect(
      consumerInventory(rows, rows, [review(file, source, 'retirement')], data).consumers.find(
        (row) => row.file === file,
      )?.status,
    ).toBe('adapter');
  }
});

it('retains active publication-byte routes for PR10 without waiving a live workspace-model consumer', () => {
  const file = 'src/app/assets/route.ts';
  const source = "export const GET = () => 'installed publication bytes';";
  const rows = [candidate(file, 'route')];
  const data = files(file, source);
  const result = consumerInventory(rows, rows, [review(file, source, 'retirement')], data);
  expect(result.pending[0]).toMatchObject({
    reachable: true,
    legacyDependency: false,
    role: 'retirement',
    stage: 10,
  });
  const reader = 'src/infrastructure/old-reader.ts';
  const live =
    "import { today } from '@/infrastructure/old-reader';\nexport const GET = () => today();";
  data.set(file, live);
  data.set(
    reader,
    "import { derive } from '@/application/plan/derive';\nexport const today = () => derive({});",
  );
  const blocked = consumerInventory(rows, rows, [review(file, live, 'retirement')], data);
  expect(blocked.consumers[0]).toMatchObject({
    status: 'adapter',
    reachable: true,
    legacyDependency: true,
  });
});

it('does not mistake a proven literal metadata import for invoking a mixed module model reader', () => {
  const file = 'src/app/assets/route.ts';
  const source =
    "import { RESERVED } from '@/application/mixed';\nexport const GET = () => RESERVED;";
  const mixed =
    "import { derive } from '@/application/plan/derive';\nexport const RESERVED = ['assets'] as const;\nexport const model = () => derive({});";
  const rows = [candidate(file, 'route')];
  const data = files(file, source);
  data.set('src/application/mixed.ts', mixed);
  const result = consumerInventory(rows, rows, [review(file, source, 'retirement')], data);
  expect(result.pending[0]).toMatchObject({
    role: 'retirement',
    legacyDependency: false,
    reachable: true,
  });
  const calls = "import { model } from '@/application/mixed';\nexport const GET = () => model();";
  data.set(file, calls);
  expect(
    consumerInventory(rows, rows, [review(file, calls, 'retirement')], data).consumers[0]?.status,
  ).toBe('adapter');
});

it('reuses a bounded UI type without importing its old reader while keeping old model contracts visible', () => {
  const file = 'src/application/native.ts';
  const source =
    "import type { View } from '@/application/mixed';\nexport const view = (value: View) => value.id;";
  const data = files(file, source);
  data.set(
    'src/application/mixed.ts',
    "import { derive } from '@/application/plan/derive';\nexport interface View { readonly id: string }\nexport const old = () => derive({});",
  );
  const rows = [candidate(file)];
  expect(consumerInventory(rows, rows, [review(file, source)], data).consumers[0]?.status).toBe(
    'migrated',
  );
  const legacy =
    "import type { Workspace } from '@/domain/workspace';\nexport const old = (value: Workspace) => value.domains;";
  data.set(file, legacy);
  expect(consumerInventory(rows, rows, [review(file, legacy)], data).consumers[0]?.status).toBe(
    'adapter',
  );
});

it('erases type aliases and type positions but still records actual old fact carriers read at runtime', () => {
  const file = 'src/application/native.ts';
  const erased =
    "import type { Model as OldModel } from '@/application/plan/derive';\nexport type Label = OldModel['label'];";
  const rows = [candidate(file)];
  const data = files(file, erased);
  const pure = consumerInventory(rows, rows, [review(file, erased)], data);
  expect(pure.consumers[0]).toMatchObject({
    status: 'migrated',
    legacyDependency: false,
    legacyUses: [],
  });
  const read =
    "import type { Workspace as OldWorkspace } from '@/domain/workspace';\nexport const domains = (value: OldWorkspace) => value.domains;";
  data.set(file, read);
  const used = consumerInventory(rows, rows, [review(file, read)], data);
  expect(used.consumers[0]).toMatchObject({
    status: 'adapter',
    legacyDependency: true,
    legacyUses: [
      {
        name: 'value',
        typeName: 'OldWorkspace',
        line: 2,
        text: 'export const domains = (value: OldWorkspace) => value.domains;',
      },
    ],
  });
});

it('keeps runtime bindings of a mixed import and discards only its erased or literal bindings', () => {
  const file = 'src/app/page.tsx';
  const source =
    "import { type Model, derive as build } from '@/application/plan/derive';\nexport const page = () => build({});\nexport type Label = Model['label'];";
  const rows = [candidate(file)];
  const data = files(file, source);
  data.set(
    'src/application/plan/derive.ts',
    "export const RESERVED = 'literal';\nexport const derive = () => ({});\nexport interface Model { readonly label: string }",
  );
  const actual = consumerInventory(rows, rows, [review(file, source)], data);
  expect(actual.consumers[0]).toMatchObject({
    status: 'adapter',
    legacyDependency: true,
    legacyUses: [{ name: 'build', line: 2, text: 'export const page = () => build({});' }],
  });
  const metadata =
    "import { type Model, RESERVED as label } from '@/application/plan/derive';\nexport const page = () => label;\nexport type Label = Model['label'];";
  data.set(file, metadata);
  const bounded = consumerInventory(rows, rows, [review(file, metadata)], data);
  expect(bounded.consumers[0]).toMatchObject({
    status: 'migrated',
    legacyDependency: false,
    legacyUses: [],
  });
});

function barrelFiles(entry: string, extra = ''): Map<string, string> {
  const data = files('src/app/page.tsx', entry);
  data.set(
    'src/features/mixed/index.ts',
    `export { leaf as NativePage } from './named';\nexport { legacy as OldPage } from './old';\n${extra}`,
  );
  data.set('src/features/mixed/named.ts', "export { render as leaf } from './native';");
  data.set('src/features/mixed/native.ts', "export const render = () => 'native facts';");
  data.set(
    'src/features/mixed/old.ts',
    "import { derive } from '@/application/plan/derive';\nexport const legacy = () => derive({});",
  );
  return data;
}

it('separates passive module reachability from an active legacy binding through named barrels', () => {
  const file = 'src/app/page.tsx';
  const old = 'src/features/mixed/old.ts';
  const source =
    "import { NativePage as Render } from '@/features/mixed';\nexport default () => Render();";
  const data = barrelFiles(source);
  const rows = [candidate(file), candidate(old)];
  const result = consumerInventory(
    rows,
    rows,
    [review(file, source), review(old, data.get(old) ?? '', 'retirement')],
    data,
  );
  expect(result.consumers.find((row) => row.file === file)).toMatchObject({
    status: 'migrated',
    legacyDependency: false,
    reachable: true,
  });
  expect(result.pending.find((row) => row.file === old)).toMatchObject({
    status: 'pending',
    legacyDependency: true,
    reachable: true,
    factBindings: [],
    activeLegacyPath: [],
  });
  expect(result.issues).toEqual([]);
  const direct = source.replace('NativePage', 'OldPage');
  data.set(file, direct);
  const active = consumerInventory(
    rows,
    rows,
    [review(file, direct), review(old, data.get(old) ?? '', 'retirement')],
    data,
  );
  expect(active.consumers.find((row) => row.file === old)).toMatchObject({
    status: 'adapter',
    reachable: true,
    factBindings: ['legacy'],
  });
  expect(active.issues).toContain(
    `${old}: A live runtime model dependency still reaches this proposed retirement.`,
  );
});

it('keeps namespace, star, side-effect and unresolved barrel paths conservative', () => {
  const file = 'src/app/page.tsx';
  const examples = [
    {
      source:
        "import * as Pages from '@/features/mixed';\nexport default () => Pages.NativePage();",
    },
    { source: "import '@/features/mixed';\nexport const ready = true;" },
    {
      source: "import { NativePage } from '@/features/mixed';\nexport default NativePage;",
      extra: "export * from './old';",
    },
    {
      source: "import { NativePage } from '@/features/mixed';\nexport default NativePage;",
      extra: "import './old';",
    },
    { source: "import { Unknown } from '@/features/mixed';\nexport default Unknown;" },
  ];
  for (const { source, extra } of examples) {
    const rows = [candidate(file)];
    const result = consumerInventory(
      rows,
      rows,
      [review(file, source)],
      barrelFiles(source, extra),
    );
    expect(result.consumers[0]).toMatchObject({ status: 'adapter', legacyDependency: true });
  }
});

const mixedRoute = (name: string): string =>
  `import { ${name} as chosen } from '@/application/mixed';
export default function Page() { return chosen(); }`;

it('follows a named export through its local helper and emits the shortest legacy fact path', () => {
  const entry = 'src/app/page.tsx';
  const mixed = 'src/application/mixed.ts';
  const reader = 'src/application/reader.ts';
  const derive = 'src/application/plan/derive.ts';
  const source = mixedRoute('nativeHref');
  const data = files(entry, source);
  data.set(
    mixed,
    [
      "import { derive as direct } from './plan/derive';",
      "import { readOld } from './reader';",
      'function localOld() { return readOld(); }',
      'function localLink() { return "/native/"; }',
      'export const nativeHref = () => localLink();',
      'export const oldFacts = () => localOld();',
      'export const directFacts = () => [localOld(), direct({})];',
    ].join('\n'),
  );
  data.set(
    reader,
    "import { derive } from './plan/derive';\nexport const readOld = () => derive({});",
  );
  const row = candidate(entry);
  const read = () => consumerInventory([row], [row], [], data).consumers[0];
  expect(read()).toMatchObject({ reachable: true, legacyDependency: false, legacyPath: [] });
  data.set(entry, mixedRoute('oldFacts'));
  expect(read()?.legacyPath).toEqual([
    entry,
    `${mixed}#oldFacts`,
    `${reader}#readOld`,
    `${derive}#derive`,
  ]);
  data.set(entry, mixedRoute('directFacts'));
  expect(read()?.legacyPath).toEqual([entry, `${mixed}#directFacts`, `${derive}#derive`]);
});

it('preserves legacy fact use in an evaluated initialiser even when the requested export is safe', () => {
  const entry = 'src/app/page.tsx';
  const mixed = 'src/application/mixed.ts';
  const reader = 'src/application/reader.ts';
  const data = files(
    entry,
    "import { href } from '@/application/mixed';\nexport const page = () => href();",
  );
  data.set(mixed, "import { readOld } from './reader';\nexport const href = () => '/native/';");
  data.set(
    reader,
    [
      "import { derive } from './plan/derive';",
      'const initialised = derive({});',
      'export const readOld = () => initialised;',
    ].join('\n'),
  );
  const row = candidate(entry);
  expect(consumerInventory([row], [row], [], data).consumers[0]?.legacyPath).toEqual([
    entry,
    `${mixed}#(evaluation)`,
    `${reader}#(evaluation)`,
    'src/application/plan/derive.ts#derive',
  ]);
});

it('does not activate a lazy legacy read in an unused sibling binding', () => {
  const entry = 'src/app/page.tsx';
  const mixed = 'src/application/mixed.ts';
  const derive = 'src/application/plan/derive.ts';
  const data = files(
    entry,
    "import { href } from '@/application/mixed';\nexport const page = () => href();",
  );
  data.set(
    mixed,
    "export const href = () => '/native/';\nexport const old = () => import('./plan/derive');",
  );
  data.set(derive, 'export const derive = () => ({});');
  const rows = [candidate(entry), candidate(derive)];
  const result = consumerInventory(rows, rows, [], data);
  expect(result.consumers.find((row) => row.file === entry)?.legacyPath).toEqual([]);
  expect(result.consumers.find((row) => row.file === derive)).toMatchObject({
    reachable: true,
    legacyDependency: true,
  });
});

it('distinguishes an explicit pure re-export from a legacy function declared beside it', () => {
  const entry = 'src/app/page.tsx';
  const mixed = 'src/application/mixed.ts';
  const data = files(entry, mixedRoute('nativeHref'));
  data.set(
    mixed,
    [
      "import type { Model } from './plan/derive';",
      "export { href as nativeHref } from './paths';",
      'export function oldFacts(model: Model) { return model.plan; }',
    ].join('\n'),
  );
  data.set('src/application/paths.ts', "export function href() { return '/native/'; }");
  const row = candidate(entry);
  expect(consumerInventory([row], [row], [], data).consumers[0]?.legacyPath).toEqual([]);
  data.set(entry, mixedRoute('oldFacts'));
  expect(consumerInventory([row], [row], [], data).consumers[0]?.legacyPath).toEqual([
    entry,
    `${mixed}#oldFacts`,
  ]);
});

it('does not execute the functions stored in an otherwise passive builder table', () => {
  const entry = 'src/app/page.tsx';
  const mixed = 'src/application/mixed.ts';
  const data = files(entry, mixedRoute('nativeHref'));
  data.set(
    mixed,
    [
      "import type { Model } from './plan/derive';",
      'function oldFacts(model: Model) { return model.plan; }',
      'const builders = { oldFacts, other: (model: Model) => model.plan };',
      "export function nativeHref() { return '/native/'; }",
      'export function legacyPage(model: Model) { return builders.oldFacts(model); }',
    ].join('\n'),
  );
  const row = candidate(entry);
  expect(consumerInventory([row], [row], [], data).consumers[0]?.legacyPath).toEqual([]);
  data.set(entry, mixedRoute('legacyPage'));
  expect(consumerInventory([row], [row], [], data).consumers[0]?.legacyPath).toEqual([
    entry,
    `${mixed}#legacyPage`,
  ]);
});

it('keeps active indirect and opaque legacy reads blocking even if the command had no text match', () => {
  const entry = 'tools/dump.ts';
  const mixed = 'src/application/mixed.ts';
  const derive = 'src/application/plan/derive.ts';
  const source = "import { query } from '@/application/mixed';\nconst answer = query();";
  const data = files(entry, source);
  data.set('package.json', '{"scripts":{"dump":"node tools/dump.ts"}}');
  const legacy =
    "import * as helpers from './plan/derive';\nexport const query = () => helpers.derive({});";
  data.set(mixed, legacy);
  const row = candidate(mixed);
  const result = consumerInventory([row], [row], [review(mixed, legacy, 'retirement')], data);
  const root = `${entry}#(evaluation)`;
  const trace = [root, `${mixed}#(evaluation)`, derive];
  expect(result.consumers.find((item) => item.file === entry)).toMatchObject({
    original: null,
    status: 'adapter',
    activeLegacyPath: trace,
  });
  expect(result.consumers.find((item) => item.file === mixed)).toMatchObject({
    status: 'adapter',
    factBindings: ['query'],
    activeLegacyPath: trace,
  });
});

it('preserves an old potential path when the actual app requests a separate native binding', () => {
  const entry = 'src/app/page.tsx';
  const mixed = 'src/application/mixed.ts';
  const source = mixedRoute('nativeHref');
  const data = files(entry, source);
  const legacy = [
    "import { derive } from './plan/derive';",
    'export const oldFacts = () => derive({});',
    "export const nativeHref = () => '/native/';",
  ].join('\n');
  data.set(mixed, legacy);
  const row = candidate(mixed);
  const unreviewed = consumerInventory([row], [row], [], data);
  expect(unreviewed.consumers[0]?.status).toBe('adapter');
  const accepted = consumerInventory([row], [row], [review(mixed, legacy)], data);
  expect(accepted.consumers[0]).toMatchObject({
    status: 'migrated',
    reachable: true,
    legacyDependency: true,
    factBindings: ['nativeHref'],
    activeLegacyPath: [],
  });
});

it('keeps old app test candidates as evidence, separate from registered routes', () => {
  const file = 'src/app/[workspace]/page.test.tsx';
  const row = candidate(file, 'route');
  const result = consumerInventory([row], [], [], files(file, "import { test } from 'vitest';"));
  expect(result.candidates[0]).toMatchObject({
    original: row,
    role: 'fixture or test',
    status: 'reference',
  });
  expect(result.consumers).toEqual([]);
});

it('discovers native page and view model consumers beyond the core index import', () => {
  for (const name of [
    '@/application/model-plan-pages',
    '@/application/model-workspace-work',
    '@/application/model-inspection',
    '@/infrastructure/model-plan-data',
    '@/infrastructure/read-model',
    '@/application/plans-index',
    '@/domain/workspace-model',
  ]) {
    expect(usesCanonicalModel(`import type { View } from '${name}';`)).toBe(true);
  }
  expect(usesCanonicalModel("import { workspaceHref } from '@/application/workspace-paths';")).toBe(
    false,
  );
});

it('keeps a tracked deletion absent in the source map and fails other source read errors', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'groundwork-inventory-source-'));
  try {
    const file = path.join(folder, 'fixture.ts');
    await writeFile(file, 'export const retained = true;');
    await expect(readInventorySource(file)).resolves.toBe('export const retained = true;');
    await rm(file);
    await expect(readInventorySource(file)).resolves.toBeNull();
    await expect(readInventorySource(folder)).rejects.toMatchObject({ code: 'EISDIR' });
  } finally {
    await rm(folder, { recursive: true });
  }
});

it('requires a textual byte receipt for a compressed proof', () => {
  const file = 'src/application/native.ts';
  const accepted = review(file, 'export const native = true;');
  expect(() =>
    inventoryReview({
      format: 1,
      original: { file: 'original.json', sha256: 'recorded', rows: 1 },
      dispositions: [
        { ...accepted, proofs: [{ file: 'captured.json.gz', sha256: 'raw-byte-hash' }] },
      ],
    }),
  ).toThrow('Inventory proofs must be text receipts; pin compressed bytes inside a text receipt.');
});
