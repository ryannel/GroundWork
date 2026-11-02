import { describe, expect, it } from 'vitest';

import {
  discoveryClaims,
  discoverySummary,
  schemaRecords,
  targetedClaims,
} from './evidence-discovery';

describe('evidence discovery', () => {
  it('keeps claims without the model run that wrote them', () => {
    const claims = discoveryClaims({
      claims: [{ id: 'claim:1', kind: 'purpose', statement: 'Serves profiles', run_id: 'run:9' }],
    });
    expect(claims).toEqual([{ id: 'claim:1', kind: 'purpose', statement: 'Serves profiles' }]);
  });

  it('records documentation findings as Inferred findings', () => {
    expect(targetedClaims({ findings: [{ id: 'registration', statement: 'Registered' }] })).toEqual(
      [{ id: 'finding:registration', kind: 'finding', label: 'Inferred', statement: 'Registered' }],
    );
  });

  it('summarises discovery, reading absent lists as empty', () => {
    expect(
      discoverySummary({ discovery_readiness: 'ready', knowledge_gaps: ['No deploy', 3] }),
    ).toEqual({
      readiness: 'ready',
      coverage: 'unknown',
      scopes: [],
      sourceDeclaredComponents: [],
      actionHosts: [],
      knowledgeGaps: ['No deploy'],
      unresolvedCandidates: [],
    });
  });

  it('gives each schema row its own id, counting repeats', () => {
    const rows = [
      { kind: 'message', fq_name: '.a.B', declaration: { id: 'repo:a.proto#.a.B' } },
      { kind: 'message', fq_name: '.a.B', declaration: { id: 'repo:a.proto#.a.B' } },
      { fq_name: '.a.C', path: 'a.proto' },
    ];
    expect(schemaRecords({ rows }).map((row) => [row.kind, row.id])).toEqual([
      ['message', 'schema:repo:a.proto#.a.B'],
      ['message', 'schema:repo:a.proto#.a.B#1'],
      ['schema', 'schema:a.proto#.a.C'],
    ]);
  });
});
