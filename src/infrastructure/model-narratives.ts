import 'server-only';

import { createHash } from 'node:crypto';

import type { ModelIndex } from '@/application/model-index';
import { modelNarrativeProblems } from '@/application/model-narratives';
import { stripPrefix } from '@/domain/ids';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import type { ModelEntity, ModelSystem } from '@/domain/workspace-model';

export interface ModelNarrativePacket {
  readonly basis: string;
  readonly input: {
    readonly system: Omit<ModelSystem, 'narratives'>;
    readonly flows: ModelIndex['model']['flows'];
    readonly repositories: readonly ModelIndex['model']['evidence'][number]['repository'][];
    readonly codeSources: ReturnType<ReturnType<typeof codeCitationResolver>>;
  };
  readonly problems: ReturnType<typeof modelNarrativeProblems>;
}
function narrativeSource(node: ModelEntity, system: string): boolean {
  if (node.kind === 'evidence') return false;
  if (node.place.system === system) return true;
  return node.kind === 'flow' || (node.kind === 'step' && node.place.system === null);
}
/** Fingerprint actual native facts and their recorded source pins; no legacy handler filename or graph is reconstructed. */
export function modelNarrativePacket(
  index: ModelIndex,
  systemId: string,
): ModelNarrativePacket | null {
  const system = index.model.domains
    .flatMap((domain) => domain.systems)
    .find(
      (candidate) => candidate.id === systemId || stripPrefix(candidate.id, 'sys') === systemId,
    );
  if (system === undefined) return null;
  const { narratives, ...facts } = system;
  const ids = index.entities
    .filter((node) => narrativeSource(node, system.id))
    .map((node) => node.id);
  const resolve = codeCitationResolver(index.model.evidence);
  const codeSources = resolve(ids.flatMap((id) => index.cites(id)));
  const repos = new Set(codeSources.map((cite) => cite.repo));
  const repositories = index.model.evidence
    .filter((repository) => repos.has(repository.repository.repo))
    .map((repository) => repository.repository);
  const input = { system: facts, flows: index.model.flows, repositories, codeSources };
  return {
    basis: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    input,
    problems: narratives === null ? [] : modelNarrativeProblems(index, system, resolve),
  };
}
