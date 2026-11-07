// Canonical proof facts use the same index queries as pages and map inspection.
import { isDeepStrictEqual } from 'node:util';

import { modelAreaViewOf } from '@/application/model-area';
import type { ModelIndex } from '@/application/model-index';
import type { IndexedPlan } from '@/application/plans-index';
import { modelList, modelRecord, type ModelRepository } from '@/domain/workspace-model';
import { readModelPlanBaseMarkers } from '@/infrastructure/model-plan-base';
import {
  readModelPlanProgress,
  readSelectedPlanContext,
  readSelectedRevisionContext,
} from '@/infrastructure/model-plan-context';
import { readModelPlanEntries, readModelPlanRevisions } from '@/infrastructure/model-plans';
import { readPlanLock } from '@/infrastructure/plan-lock';

import { digest, writeSnapshot } from './snapshots';

export function indexedModelFacts(index: ModelIndex): object {
  const nodes = index.entities.filter((node) => node.kind !== 'evidence');
  const ofKind = (kind: string): readonly string[] =>
    nodes.filter((node) => node.kind === kind).map((node) => node.id);
  return {
    identities: nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      parent: node.parent,
      place: index.place(node.id),
      label: index.label(node.id),
      owningTeam: index.owningTeam(node.id),
      resourceOwner: index.resourceOwner(node.id),
      codeHomes: index.codeHomes(node.id),
      cites: index.cites(node.id),
    })),
    componentEdges: index.edges(),
    systemEdges: index.edges(undefined, { level: 'system' }),
    callers: Object.fromEntries(
      index.entries().map((entry) => [entry.id, index.callers(entry.id)]),
    ),
    messages: Object.fromEntries(
      ofKind('message').map((id) => [
        id,
        { producers: index.producers(id), consumers: index.consumers(id) },
      ]),
    ),
    storeAccess: Object.fromEntries(
      [...ofKind('store'), ...ofKind('topic')].map((id) => [id, index.storeAccess(id)]),
    ),
    roles: Object.fromEntries(
      [...ofKind('service'), ...ofKind('app')].map((id) => [id, index.roles(id)]),
    ),
    fieldsReached: Object.fromEntries(
      ofKind('operation').map((id) => [id, index.fieldsReached(id)]),
    ),
    gaps: index.gaps(),
  };
}

interface FactShard {
  readonly file: string;
  readonly sha256: string;
}

interface FactWriter {
  readonly files: readonly string[];
  readonly write: (key: string, value: unknown) => Promise<FactShard>;
  readonly evidence: (
    scope: string,
    records: readonly ModelRepository[],
  ) => Promise<readonly FactShard[]>;
}

function factWriter(out: string): FactWriter {
  const files: string[] = [];
  const known = new Map<string, { readonly value: ModelRepository; readonly shard: FactShard }[]>();
  const write: FactWriter['write'] = async (key, value) => {
    const file = `facts-${digest(key).slice(0, 20)}.json.gz`;
    if (files.includes(file)) throw new Error(`Duplicate fact shard: ${key}`);
    const sha256 = await writeSnapshot(out, file, value);
    files.push(file);
    return { file, sha256 };
  };
  const evidence: FactWriter['evidence'] = async (scope, records) => {
    const shards: FactShard[] = [];
    for (const [position, value] of records.entries()) {
      const repo = value.repository.repo;
      const previous = known.get(repo) ?? [];
      const retained = previous.find((item) => isDeepStrictEqual(value, item.value));
      if (retained !== undefined) {
        shards.push(retained.shard);
        continue;
      }
      const shard = await write(`${scope}/evidence/${String(position)}`, value);
      known.set(repo, [...previous, { value, shard }]);
      shards.push(shard);
    }
    return shards;
  };
  return { files, write, evidence };
}

async function projectionOf(writer: FactWriter, scope: string, index: ModelIndex) {
  const { evidence, ...model } = index.model;
  return {
    model: await writer.write(`${scope}/model`, model),
    derived: await writer.write(`${scope}/derived`, indexedModelFacts(index)),
    evidence: await writer.evidence(scope, evidence),
  };
}

async function planProjection(writer: FactWriter, scope: string, context: IndexedPlan | null) {
  if (context === null) throw new Error(`Missing selected projection: ${scope}`);
  return {
    plan: context.plan,
    proposals: context.proposals,
    before: await projectionOf(writer, `${scope}/before`, context.beforeIndex),
    after: await projectionOf(writer, `${scope}/after`, context.afterIndex),
  };
}

async function writeAreas(writer: FactWriter, index: ModelIndex) {
  const areas = [];
  for (const area of index.model.landscape?.areas ?? []) {
    const view = modelAreaViewOf(index, area.id);
    if (view === null) throw new Error(`Missing canonical area: ${area.id}`);
    areas.push({ id: area.id, view: await writer.write(`area/${area.id}`, view) });
  }
  return areas;
}

async function writePlan(writer: FactWriter, current: ModelIndex, slug: string, root?: string) {
  const id = current.model.id;
  const scope = `plan/${slug}`;
  const context = await readSelectedPlanContext(id, slug, root, current, { retain: false });
  const selected = await planProjection(writer, scope, context);
  const base = await readModelPlanBaseMarkers(id, root);
  const progress = await readModelPlanProgress(id, slug, root);
  const lock = await readPlanLock(id, slug, root);
  const revisions = [];
  for (const { version } of await readModelPlanRevisions(id, slug, root)) {
    const revision = await readSelectedRevisionContext(id, slug, version, root, {
      currentIndex: current,
      retain: false,
    });
    const revisionScope = `${scope}/revision/${version}`;
    revisions.push({
      version,
      projection: await planProjection(writer, revisionScope, revision),
    });
  }
  return {
    slug,
    ...selected,
    base: base.get(selected.plan.meta.id) ?? null,
    lock,
    progress,
    revisions,
  };
}

/** Each complete fact has one stored value or an exact reference to an identical evidence shard. */
export async function writeModelFacts(
  out: string,
  current: ModelIndex,
  root?: string,
  explorer?: unknown,
): Promise<readonly string[]> {
  const writer = factWriter(out);
  const projection = await projectionOf(writer, 'current', current);
  const areas = await writeAreas(writer, current);
  const plans = [];
  for (const { slug } of await readModelPlanEntries(current.model.id, root)) {
    plans.push(await writePlan(writer, current, slug, root));
  }
  const file = 'facts.json.gz';
  await writeSnapshot(out, file, {
    format: 2,
    current: { ...projection, areas },
    plans,
    ...(explorer === undefined ? {} : { explorer }),
  });
  return [file, ...writer.files];
}

function shardsOf(value: unknown): readonly unknown[] {
  const projection = modelRecord(value);
  if (projection === null || !Array.isArray(projection.evidence)) {
    throw new Error('Missing native fact projection.');
  }
  return [projection.model, projection.derived, ...projection.evidence];
}

function planShards(value: unknown): readonly unknown[] {
  const plan = modelRecord(value);
  if (plan === null) throw new Error('Missing native plan facts.');
  return [...shardsOf(plan.before), ...shardsOf(plan.after)];
}

/** Validate the complete set of native shard references before comparing their captured values. */
function revisionShards(value: unknown): readonly unknown[] {
  const plan = modelRecord(value);
  if (plan === null || !Array.isArray(plan.revisions)) {
    throw new Error('Missing native revision facts.');
  }
  const revisions = modelList(plan.revisions).flatMap((revision) =>
    planShards(modelRecord(revision)?.projection),
  );
  return [...planShards(plan), ...revisions];
}

function shardReference(value: unknown): FactShard {
  const shard = modelRecord(value);
  const file = shard?.file;
  const sha256 = shard?.sha256;
  if (
    typeof file !== 'string' ||
    !/^facts-[a-f0-9]{20}\.json\.gz$/u.test(file) ||
    typeof sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(sha256)
  ) {
    throw new Error('Invalid native fact shard reference.');
  }
  return { file, sha256 };
}

export function factChecksums(value: unknown): ReadonlyMap<string, string> {
  const facts = modelRecord(value);
  if (facts?.format !== 2) return new Map();
  const current = modelRecord(facts.current);
  if (current === null || !Array.isArray(current.areas) || !Array.isArray(facts.plans)) {
    throw new Error('Incomplete native facts manifest.');
  }
  const refs = [
    ...shardsOf(current),
    ...modelList(current.areas).map((area) => modelRecord(area)?.view),
    ...modelList(facts.plans).flatMap(revisionShards),
  ];
  const checksums = new Map<string, string>();
  for (const ref of refs) {
    const { file, sha256 } = shardReference(ref);
    const previous = checksums.get(file);
    if (previous !== undefined && previous !== sha256) {
      throw new Error(`Conflicting checksums for fact shard: ${file}`);
    }
    checksums.set(file, sha256);
  }
  return checksums;
}
