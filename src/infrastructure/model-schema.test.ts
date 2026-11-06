import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ValidateFunction } from 'ajv';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { EVIDENCE_FAMILIES } from '@/domain/evidence/evidence';
import type { ContractDefinition, ContractFamily } from '@/domain/model/contracts.generated';

import { checkModelData, modelAjv, modelValidator, readModelFile } from './model-schema';

vi.mock(import('server-only'), () => ({}));

const fixture = path.resolve('test/fixtures/model');
const system = 'domains/orders/systems/ordering';
const workspaceFiles = [
  ['WorkspaceFile', 'workspace.yaml'],
  ['AliasesFile', 'aliases.yaml'],
  ['LibrariesFile', 'libraries.yaml'],
  ['ExternalsFile', 'externals.yaml'],
  ['LanguageFile', 'language.yaml'],
  ['DomainFile', 'domains/orders/domain.yaml'],
  ['DomainLanguageFile', 'domains/orders/language.yaml'],
  ['TargetFile', 'domains/orders/target.yaml'],
  ['SystemFile', `${system}/system.yaml`],
  ['ContractsFile', `${system}/contracts.yaml`],
  ['ScreensFile', `${system}/screens.yaml`],
  ['HandlersFile', `${system}/handlers/ordering.yaml`],
  ['NarrativesFile', `${system}/narratives.yaml`],
  ['GraphFile', 'graphs/shop.yaml'],
  ['FlowFile', 'flows/confirm.yaml'],
  ['JourneyFile', 'journeys/buy.yaml'],
  ['ProgrammeFile', 'programmes/orders.yaml'],
  ['LandscapeFile', 'landscape.yaml'],
] as const;
const invalidFiles = [
  ['workspace', 'HandlersFile', 'invalid/handler.yaml', '/0/steps/0'],
  ['workspace', 'ContractsFile', 'invalid/schema.yaml', '/schemas/0/fields/0/type'],
  ['workspace', 'AliasesFile', 'invalid/aliases.yaml', '/api:retired'],
  ['plan', 'document', 'invalid/plan.yaml', '/changes/0/ops/0/modify'],
  ['evidence', 'sources', 'invalid/evidence.yaml', '/lines/0'],
] as const;
const direct = modelAjv();

beforeAll(async () => {
  for (const family of ['workspace', 'plan', 'evidence']) {
    const schema: unknown = JSON.parse(await readFile(`schema/${family}.schema.json`, 'utf8'));
    if (typeof schema !== 'object' || schema === null) throw new Error('Expected a schema object');
    direct.addSchema(schema);
  }
});

function directCheck(family: ContractFamily, definition: string): ValidateFunction {
  const suffix = definition === 'document' ? '' : `#/$defs/${definition}`;
  const check = direct.getSchema(`https://groundwork.local/schema/${family}.schema.json${suffix}`);
  if (check === undefined) throw new Error(`Missing fixture contract: ${definition}`);
  return check;
}

async function fixtureValue(file: string): Promise<unknown> {
  return parse(await readFile(path.join(fixture, file), 'utf8'));
}

async function assertValid<Family extends ContractFamily>(
  family: Family,
  definition: ContractDefinition<Family>,
  file: string,
): Promise<void> {
  const value = await fixtureValue(file);
  const check = directCheck(family, definition);
  expect(check(value), JSON.stringify(check.errors?.slice(0, 8))).toBe(true);
  const loaded = await readModelFile(family, definition, path.join(fixture, file));
  expect(loaded.errors).toEqual([]);
  expect(loaded.data).toEqual(value);
  // The root document accepts exactly the same authored fixture as its named definition.
  expect(directCheck(family, 'document')(value)).toBe(true);
}

describe('the handwritten canonical model', () => {
  it.each(workspaceFiles)(
    'loads %s from %s through its generated contract',
    async (definition, file) => {
      await assertValid('workspace', definition, file);
    },
  );
  it('loads an overlay with nested step, field, region and failure targets', async () => {
    await assertValid('plan', 'document', 'plans/confirm/plan.yaml');
  });
  it('keeps unknown store ownership and schedules absent', async () => {
    const systemData = await readModelFile(
      'workspace',
      'SystemFile',
      path.join(fixture, system, 'system.yaml'),
    );
    expect(
      systemData.data?.components?.find((component) => component.id === 'st:unknown-owner'),
    ).not.toHaveProperty('owner');
    const contracts = await readModelFile(
      'workspace',
      'ContractsFile',
      path.join(fixture, system, 'contracts.yaml'),
    );
    expect(contracts.data?.jobs?.find((job) => job.id === 'job:unknown')).toEqual({
      id: 'job:unknown',
      component: 'svc:ordering',
    });
  });
});

describe('all evidence families use the same contract boundary', () => {
  it.each(EVIDENCE_FAMILIES)('loads handwritten %s evidence', async (family) => {
    await assertValid('evidence', family, `evidence/example/orders/${family}.yaml`);
  });
  it('keeps the repository pin outside individual records', async () => {
    await assertValid('evidence', 'EvidenceRepository', 'evidence/example/orders/repository.json');
    const source = await readModelFile(
      'evidence',
      'sources',
      path.join(fixture, 'evidence/example/orders/sources.yaml'),
    );
    expect(source.data).toMatchObject({ file: 'ev:file', lines: [1, 80] });
    expect(source.data).not.toHaveProperty('path');
    expect(source.data).not.toHaveProperty('commit');
  });
  it.each(EVIDENCE_FAMILIES)('rejects a legacy id in %s evidence', async (family) => {
    const original = await fixtureValue(`evidence/example/orders/${family}.yaml`);
    if (typeof original !== 'object' || original === null) {
      throw new Error('Expected a record fixture');
    }
    const value = { ...original, id: 'legacy-id' };
    const check = directCheck('evidence', family);
    expect(check(value)).toBe(false);
    const result = await checkModelData('evidence', family, value);
    expect(result.data).toBeNull();
    expect(result.errors.map((error) => error.path)).toEqual(
      check.errors?.map((error) => error.instancePath),
    );
    expect(result.errors.some((error) => error.path === '/id')).toBe(true);
  });
});

describe('invalid fixtures have the same error paths directly and at load', () => {
  it.each(invalidFiles)('%s %s rejects %s', async (family, _definition, file, expectedPath) => {
    const value = await fixtureValue(file);
    const check = directCheck(family, 'document');
    expect(check(value)).toBe(false);
    const loaded = await readModelFile(family, 'document', path.join(fixture, file));
    expect(loaded.data).toBeNull();
    expect(loaded.errors.map((error) => error.path)).toEqual(
      check.errors?.map((error) => error.instancePath),
    );
    expect(loaded.errors.some((error) => error.path === expectedPath)).toBe(true);
  });
  it('rejects duplicate children across branches, lanes and retry exhaustion', async () => {
    const child = { id: 'same', does: 'Compute' };
    for (const block of [
      parse(
        'id: block\nif: Allowed\nthen: [{ id: same, does: Compute }]\nelse: [{ id: same, does: Compute }]',
      ),
      { id: 'block', parallel: [{ steps: [child] }, { lane: 'Other', steps: [child] }] },
      { id: 'block', retry: { until: 'Ready', exhausted: [child] }, steps: [child] },
      { id: 'block', try: [child], catch: [child], finally: [child] },
    ]) {
      const result = await checkModelData('workspace', 'Step', block);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: '', keyword: 'uniqueChildIds' }),
      );
    }
  });
  it.each([
    { id: 'long', say: 'x'.repeat(61) },
    { id: 'unpaired', from: 'st:orders' },
    { id: 'unpaired', to: 'st:orders' },
    JSON.parse('{"id":"guard","then":[]}'),
    { id: 'block', steps: [] },
    { id: 'multi', transaction: true, each: 'Line', steps: [] },
    { id: 'legacy', do: [] },
    { id: 'origin', origin: { path: 'src/Confirm.ts' } },
  ])('rejects an invalid step shape %#', async (value) => {
    const result = await checkModelData('workspace', 'Step', value);
    expect(result.data).toBeNull();
  });
  it('rejects the wrong protocol and ambiguous interface ownership', async () => {
    for (const value of [
      {
        id: 'if:bad',
        kind: 'rest',
        component: 'svc:ordering',
        entries: [{ id: 'api:bad', rpc: 'Orders/Confirm' }],
      },
      {
        id: 'if:bad',
        kind: 'sdk',
        component: 'svc:ordering',
        external: 'ext:payments',
        entries: [],
      },
    ]) {
      const result = await checkModelData('workspace', 'Interface', value);
      expect(result.data).toBeNull();
    }
  });
  it('accepts resolved citations but rejects authored Git-host links', async () => {
    const code = {
      kind: 'code',
      repo: 'example/orders',
      commit: 'a'.repeat(40),
      path: 'src/Confirm.ts',
      lines: [1, 8],
    };
    const resolved = await checkModelData('workspace', 'Cite', code);
    expect(resolved.data).toEqual(code);
    const evidence = await checkModelData('workspace', 'Cite', {
      kind: 'evidence',
      id: 'ev:source',
    });
    expect(evidence.errors).toEqual([]);
    const authored = await checkModelData(
      'workspace',
      'AuthoredCite',
      'https://github.com/example/orders/blob/main/a.ts',
    );
    expect(authored.data).toBeNull();
  });
  it('reuses compiled validators without retaining previous validation errors', async () => {
    const first = await modelValidator('workspace', 'Step');
    expect(first({ id: 'bad', return: 200 })).toBe(false);
    await expect(modelValidator('workspace', 'Step')).resolves.toBe(first);
    expect(first({ id: 'compute', does: 'Compute' })).toBe(true);
    expect(first.errors).toBeNull();
  });
});
