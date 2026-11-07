import type { WorkspaceModel } from '@/domain/workspace-model';
import { parseInline, type Inline } from '@/shared/markdown';

/** Record counts exclude repository and discovery metadata, which travel in full. */
export interface EvidenceTransportCounts {
  readonly total: number;
  readonly loaded: number;
  readonly omitted: number;
}
export interface ModelTransportProfile {
  readonly kind: 'authored-evidence-closure';
  readonly lookup: string;
  readonly current?: EvidenceTransportCounts;
  readonly before?: EvidenceTransportCounts;
  readonly after?: EvidenceTransportCounts;
}
interface ScopedModel {
  readonly model: WorkspaceModel;
  readonly counts: EvidenceTransportCounts;
}
export interface EvidenceTransport {
  readonly scope: (model: WorkspaceModel) => ScopedModel;
}

/** Collect exact known references and prose links without changing their values. */
export function referenceCollector(
  known: ReadonlyMap<string, readonly unknown[]>,
  enqueue: (id: string) => void,
): (value: unknown) => void {
  const found = new Set<string>();
  const include = (id: string): void => {
    if (!known.has(id) || found.has(id)) return;
    found.add(id);
    enqueue(id);
  };
  const inline = (part: Inline): void => {
    if (part.kind === 'ref') include(part.id);
    if ('children' in part) {
      for (const child of part.children) inline(child);
    }
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      include(value);
      if (value.includes('[[')) {
        for (const part of parseInline(value, (id) => known.has(id))) inline(part);
      }
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const entries: readonly [string, unknown][] = Object.entries(value);
    for (const [key, child] of entries) {
      include(key);
      visit(child);
    }
  };
  return visit;
}

function evidenceValuesOf(
  models: readonly WorkspaceModel[],
): ReadonlyMap<string, readonly unknown[]> {
  const known = new Map<string, unknown[]>();
  for (const model of models) {
    for (const repo of model.evidence) {
      for (const record of repo.records) {
        const values = known.get(record.data.id) ?? [];
        values.push(record.data);
        known.set(record.data.id, values);
      }
    }
  }
  return known;
}

/** Keep every referenced record and its transitive support without rewriting any authored value. */
export function evidenceTransportOf(
  models: readonly WorkspaceModel[],
  references: readonly unknown[] = [],
): EvidenceTransport {
  const known = evidenceValuesOf(models);
  const queue: string[] = [];
  const collect = referenceCollector(known, (id) => {
    queue.push(id);
  });
  for (const model of models) {
    const { evidence, ...authored } = model;
    collect(authored);
    for (const repo of evidence) {
      collect(repo.repository);
      collect(repo.discovery);
    }
  }
  for (const reference of references) collect(reference);
  for (const id of queue) {
    for (const value of known.get(id) ?? []) collect(value);
  }
  const included = new Set(queue);
  return {
    scope: (model) => {
      const evidence = model.evidence.map((repo) => ({
        ...repo,
        records: repo.records.filter((record) => included.has(record.data.id)),
      }));
      const total = model.evidence.reduce((count, repo) => count + repo.records.length, 0);
      const loaded = evidence.reduce((count, repo) => count + repo.records.length, 0);
      return { model: { ...model, evidence }, counts: { total, loaded, omitted: total - loaded } };
    },
  };
}
