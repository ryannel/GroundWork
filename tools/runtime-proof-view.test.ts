import { describe, expect, it, vi } from 'vitest';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import { recordIndexes, type KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeBundle, QueryResponse } from '@/domain/knowledge/knowledge.generated';

import { contractView } from './runtime-proof-contracts';
import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { componentInternals } from './runtime-proof-internals';
import { interactionLines } from './runtime-proof-layout';
import { runtimeProofPage } from './runtime-proof-page';
import { runtimeOverview, wrapped } from './runtime-proof-svg';
import { type RuntimeProofView, viewRecords } from './runtime-proof-view';

vi.mock(import('server-only'), () => ({}));
function readerFor(bundle: KnowledgeBundle): KnowledgeReader {
  const records = new Map(bundle.records.map((record) => [record.id, record]));
  return {
    snapshot: 'view-test',
    rules: 'knowledge-query/v3',
    get: (id) => records.get(id),
    select: (field, value) =>
      bundle.records.filter((record) => recordIndexes(record).get(field)?.includes(value) === true),
  };
}
async function viewFor(name: 'capture' | 'soft-offer'): Promise<RuntimeProofView> {
  const { bundle } = await runtimeProofInput(name);
  const reader = readerFor(bundle);
  const interactions = queryKnowledge(reader, runtimeRequest(name, reader.snapshot));
  const trace = queryKnowledge(
    reader,
    runtimeRequest(name, reader.snapshot, { query: 'continuations' }),
  );
  return { name, interactions, trace };
}
describe('component explorer proof views', () => {
  it('keeps additional source implementations and long names inside the diagram', async () => {
    const original = await viewFor('capture');
    const execution = original.trace.records.find((record) => record.kind === 'execution_binding');
    const node = original.trace.nodes[0];
    if (execution?.kind !== 'execution_binding' || node === undefined) {
      throw new Error('Missing host');
    }
    const additions = Array.from({ length: 8 }, (_, index) => ({
      ...execution,
      id: `extra-execution/${String(index)}`,
      implementation: `extra-implementation/${String(index)}`,
    }));
    const implementations = additions.map((binding) => ({
      id: binding.implementation,
      kind: 'implementation' as const,
      logicalId: 'PaymentSessionService.getByPaymentSessionId',
      scope: 'source',
      entry: node.record,
      parameters: [],
      evidence: [],
    }));
    const trace = {
      ...original.trace,
      records: [...original.trace.records, ...additions, ...implementations],
      nodes: [
        ...original.trace.nodes,
        ...additions.map((binding) => ({ ...node, id: binding.id, execution: binding.id })),
      ],
    };
    const drawing = componentInternals({ ...original, trace }, execution.component);
    const dimensions = /viewBox="0 0 (\d+) (\d+)"/u.exec(drawing);
    const width = Number(dimensions?.[1]);
    const height = Number(dimensions?.[2]);
    const boxes = [
      ...drawing.matchAll(/<rect class="node" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/gu),
    ];
    expect(boxes.length).toBeGreaterThan(8);
    for (const box of boxes) {
      expect(Number(box[1]) + Number(box[3])).toBeLessThanOrEqual(width);
      expect(Number(box[2]) + Number(box[4])).toBeLessThanOrEqual(height);
    }
    expect(drawing).toContain('PaymentSessionService.getByPaymentSessionId');
    expect(drawing).not.toContain('>extra-implementation/');
    expect(
      wrapped('PaymentSessionService.getByPaymentSessionId').every((line) => line.length <= 29),
    ).toBe(true);
  });

  it('groups nine call sites into five component connections without discarding call sites', async () => {
    const view = await viewFor('soft-offer');
    const groups = interactionLines(view);
    expect(groups).toHaveLength(5);
    expect(groups.flatMap((group) => group.edges)).toHaveLength(9);
  });
  it('renders components first and exposes internal logic and GitHub-backed contracts', async () => {
    const view = await viewFor('soft-offer');
    const page = runtimeProofPage(view);
    expect(runtimeOverview(view)).toContain('href="#u3-component-mas"');
    expect(page).toContain('Source DTO or construction');
    expect(page).toContain('soft_offer.proto#L1-L22');
    expect(page).toContain('operationId: string · optional · nullable');
    expect(page.indexOf('Choose a component')).toBeLessThan(
      page.indexOf('Code inside this component'),
    );
    expect(page).toContain('href="#u3-runs-s2-publish"');
  });
  it('keeps unresolved destinations and candidate schemas visible and qualified', async () => {
    const view = await viewFor('capture');
    const page = runtimeProofPage(view);
    expect(page).toContain('Candidate only · excluded from runtime binding');
    expect(page).toContain('HTTP route unresolved');
    expect(runtimeOverview(view)).toContain('Capture client invocation (unresolved)');
  });
  it('handles recursive candidate schema references without expanding forever', async () => {
    const view = await viewFor('capture');
    const records = viewRecords(view);
    const original = records.get('u3/contract/candidate-client');
    if (original?.kind !== 'interface_contract') throw new Error('Missing candidate contract');
    const contract = { ...original, candidates: [original.id] };
    const cycle = new Map(records);
    cycle.set(contract.id, contract);
    expect(contractView(contract, cycle)).toContain('Recursive candidate reference');
  });
  it('can draw a source-local query without claiming extra runtime components', async () => {
    const view = await viewFor('capture');
    const trace: QueryResponse = view.trace;
    expect(new Set(trace.nodes.map((node) => node.component))).toEqual(
      new Set(['u3/component/transaction']),
    );
    expect(runtimeProofPage(view)).not.toContain('SERVICE · TransactionClient');
  });
});
