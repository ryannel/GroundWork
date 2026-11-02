import { describe, expect, it } from 'vitest';

import { replayArguments, verifyAcceptedRoster } from './scan-native-replay-input';
import { exactReplayIdentity, semanticEdgeIdMigration } from './scan-native-replay-migration';

function fixture() {
  const source = {
    kind: 'source',
    id: 'source',
    repo: 'fixture/repo',
    commit: 'pinned',
    lines: [1, 4],
  };
  const first = {
    kind: 'semantic_edge',
    id: 'edge:1',
    owner: 'method',
    source: 'source',
    from: 'call',
    to: 'argument',
    relation: 'argument',
    position: 0,
    label: 'value',
  };
  const second = { ...first, id: 'edge:2', to: 'receiver', relation: 'receiver' };
  return { source, first, second, before: [source, first, second] };
}

describe('explicit semantic-edge identity migration', () => {
  it('preserves the strict default and requires the one explicit migration flag', () => {
    expect(replayArguments(['source', 'baseline', 'specs', 'output']).semanticEdgeIdMigration).toBe(
      false,
    );
    expect(
      replayArguments(['source', 'baseline', 'specs', 'output', '--semantic-edge-id-migration'])
        .semanticEdgeIdMigration,
    ).toBe(true);
    expect(() => replayArguments(['source', 'baseline', 'specs', 'output', '--loose'])).toThrow(
      'Usage',
    );
    expect(() => replayArguments(['source', 'baseline', 'specs'])).toThrow('Usage');
    expect(() =>
      replayArguments(['source', 'baseline', 'specs', '', '--semantic-edge-id-migration']),
    ).toThrow('Missing replay argument');
  });

  it('verifies unique edge body mappings while keeping non-edge IDs and payloads exact', () => {
    const { source, first, second, before } = fixture();
    const result = semanticEdgeIdMigration(before, [
      source,
      { ...second, id: 'edge:12' },
      { ...first, id: 'edge:11' },
    ]);
    expect(result).toMatchObject({
      verified: true,
      identityExact: false,
      unchangedNonEdges: 1,
      semanticEdges: 2,
      changedEdgeIds: 2,
      reason: null,
    });
    expect(result.mapping).toEqual([
      { old_id: 'edge:1', new_id: 'edge:11' },
      { old_id: 'edge:2', new_id: 'edge:12' },
    ]);
    expect(exactReplayIdentity(before, before)).toBe(true);
    expect(exactReplayIdentity(before, [source, { ...first, id: 'renamed' }, second])).toBe(false);
    expect(exactReplayIdentity([null], [null])).toBe(false);
    expect(semanticEdgeIdMigration(before, before)).toMatchObject({
      verified: true,
      identityExact: true,
      changedEdgeIds: 0,
    });
  });

  it('retains the accepted frozen roster gate in migration mode', () => {
    const accepted = {
      allSupported: true,
      q08DefaultSupported: true,
      q08DefaultMutations: 8,
      probes: [{ scope: 'scope', probe: 'frozen' }],
    };
    expect(() => {
      verifyAcceptedRoster(accepted, accepted.probes);
    }).not.toThrow();
    expect(() => {
      verifyAcceptedRoster(accepted, [{ scope: 'scope', probe: 'changed' }]);
    }).toThrow('denominator changed');
    expect(() => {
      verifyAcceptedRoster({ ...accepted, allSupported: false }, accepted.probes);
    }).toThrow('not accepted');
  });

  it('maps a reused old ID to the correct body elsewhere rather than accepting a same-ID collision', () => {
    const { source, first, second, before } = fixture();
    const result = semanticEdgeIdMigration(before, [
      source,
      { ...second, id: first.id },
      { ...first, id: second.id },
    ]);
    expect(result.verified).toBe(true);
    expect(result.identityExact).toBe(false);
    expect(result.mapping).toEqual([
      { old_id: 'edge:1', new_id: 'edge:2' },
      { old_id: 'edge:2', new_id: 'edge:1' },
    ]);
  });

  it('rejects changes to references, ownership, relation, position, label or any added edge field', () => {
    const { source, first, second, before } = fixture();
    for (const mutation of [
      { owner: 'foreign' },
      { source: 'other-source' },
      { from: 'other-call' },
      { to: 'missing' },
      { relation: 'receiver' },
      { position: 1 },
      { label: 'other' },
      { runtime: true },
      { position: null },
    ]) {
      expect(
        semanticEdgeIdMigration(before, [source, { ...first, ...mutation, id: 'new-edge' }, second])
          .verified,
      ).toBe(false);
    }
    const absent = { ...first };
    Reflect.deleteProperty(absent, 'position');
    expect(semanticEdgeIdMigration(before, [source, absent, second]).verified).toBe(false);
  });

  it('rejects changed source pins, non-edge payloads and non-edge IDs', () => {
    const { source, first, second, before } = fixture();
    for (const mutation of [
      { commit: 'foreign' },
      { repo: 'other/repo' },
      { id: 'renamed' },
      { lines: [1, 5] },
    ]) {
      expect(
        semanticEdgeIdMigration(before, [{ ...source, ...mutation }, first, second]).verified,
      ).toBe(false);
    }
  });

  it('rejects missing records, duplicate IDs and ambiguous duplicate edge bodies', () => {
    const { source, first, second, before } = fixture();
    expect(semanticEdgeIdMigration(before, [source, first]).verified).toBe(false);
    expect(
      semanticEdgeIdMigration(before, [source, first, { ...second, id: first.id }]).verified,
    ).toBe(false);
    expect(
      semanticEdgeIdMigration(
        [source, first, { ...first, id: 'duplicate-body' }],
        [source, first, { ...first, id: 'new-body' }],
      ).verified,
    ).toBe(false);
    expect(
      semanticEdgeIdMigration([source, first, { ...first, id: first.id }], before).verified,
    ).toBe(false);
    expect(semanticEdgeIdMigration([null], [null]).verified).toBe(false);
  });
});
