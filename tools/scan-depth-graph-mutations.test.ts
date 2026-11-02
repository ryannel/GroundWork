import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { addressWire } from './scan-depth-next-address';
import { semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));

function addressGraph() {
  const content = `
    function AddressInput({onSelectAction}: Props) {
      function handlePlaceChanged() {
        if (!autocomplete) return;
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;
        onSelectAction({address: place.formatted_address ?? "", lat: place.geometry.location.lat(), lng: place.geometry.location.lng()});
      }
      return <Autocomplete onPlaceChanged={handlePlaceChanged}/>;
    }
    function StepAddress() {
      async function handleSelect(location: Location) {
        await fetch('/api/ev-subsidy/eligibility', {method: 'POST', body: JSON.stringify({lat: location.lat, lng: location.lng})});
      }
      return <AddressInput onSelectAction={handleSelect}/>;
    }
  `;
  const index = indexSource({ path: 'address.tsx', language: 'typescript', content });
  const facts = extractLocalFacts(index, {
    host: 'host:fixture',
    repo: 'fixture/repo',
    commit: 'pinned',
  });
  const document = scanFixture();
  document.semantic = [...(facts.semantic ?? [])];
  return semanticGraph(document);
}

describe('independent typed benchmark mutations', () => {
  it('rejects a changed latitude selector while the original source text is retained', () => {
    const graph = addressGraph();
    expect(addressWire(graph, 'fixture').status).toBe('supported');
    const semantic = (graph.document.semantic ?? []).map((record) =>
      record.kind === 'semantic_node' &&
      record.nodeKind === 'member' &&
      record.syntax === 'location.lat'
        ? { ...record, name: 'wrong' }
        : record,
    );
    const changed = semanticGraph({ ...graph.document, semantic });
    expect(addressWire(changed, 'fixture').status).not.toBe('supported');
  });

  it('rejects a changed parsed method value while source spelling remains POST', () => {
    const graph = addressGraph();
    const semantic = (graph.document.semantic ?? []).map((record) =>
      record.kind === 'semantic_node' && record.nodeKind === 'literal' && record.value === 'POST'
        ? { ...record, value: 'DELETE' }
        : record,
    );
    expect(addressWire(semanticGraph({ ...graph.document, semantic }), 'fixture').status).not.toBe(
      'supported',
    );
  });

  it('requires callback declaration bindings rather than their names alone', () => {
    const graph = addressGraph();
    const callbacks = new Set(
      graph.nodes
        .filter(
          (node) =>
            node.nodeKind === 'identifier' &&
            ['handleSelect', 'handlePlaceChanged'].includes(node.name ?? ''),
        )
        .map((node) => node.id),
    );
    const semantic = (graph.document.semantic ?? []).filter(
      (record) =>
        record.kind !== 'semantic_edge' ||
        record.relation !== 'binds' ||
        !callbacks.has(record.from),
    );
    expect(addressWire(semanticGraph({ ...graph.document, semantic }), 'fixture').status).not.toBe(
      'supported',
    );
  });
});
