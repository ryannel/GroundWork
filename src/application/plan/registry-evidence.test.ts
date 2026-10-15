import { describe, expect, it } from 'vitest';

import { type EvidenceModel, registryEvidence } from '@/application/plan/registry-evidence';

describe('registryEvidence', () => {
  const operation = { id: 'gql:any', name: 'Anything', plan_check: { fetches: 2 } };
  const questions: { id: string; question: string; status: string }[] = [];
  const model: EvidenceModel = {
    asIs: { byId: new Map([[operation.id, operation]]) },
    plan: { questions },
  };

  it('depends on recorded checks and open questions, not fixture ids', () => {
    expect(registryEvidence(model, operation.id, operation)).toEqual({
      evidence: true,
      question: null,
    });
    const changed = { ...operation, plan_check: { fetches: 3 } };
    expect(registryEvidence(model, operation.id, changed).evidence).toBe(false);
    questions.push({
      id: 'q:any',
      question: 'Does the registry query plan for [[gql:any]] agree?',
      status: 'open',
    });
    expect(registryEvidence(model, operation.id, operation)).toEqual({
      evidence: false,
      question: 'q:any',
    });
    questions.length = 0;
    questions.push({ id: 'q:any', question: 'registry for [[gql:any]]', status: 'resolved' });
    expect(registryEvidence(model, operation.id, operation).evidence).toBe(true);
  });

  it('finds a question that names the operation instead of its id', () => {
    questions.length = 0;
    questions.push({
      id: 'q:name',
      question: 'Is the plan_check for Anything fast?',
      status: 'open',
    });
    expect(registryEvidence(model, operation.id, operation).question).toBe('q:name');
  });

  it('takes the name from the model, and has no evidence for an unknown id', () => {
    questions.length = 0;
    const named: EvidenceModel = {
      ...model,
      get: () => ({ name: 'Anything' }),
      plan: { questions: [{ id: 'q:n', question: 'registry for Anything', status: 'open' }] },
    };
    expect(registryEvidence(named, operation.id, { plan_check: { fetches: 2 } }).question).toBe(
      'q:n',
    );
    expect(registryEvidence(model, 'gql:other', operation).evidence).toBe(false);
    expect(registryEvidence({ asIs: { byId: new Map() } }, 'x').question).toBeNull();
  });
});
