import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { Answer, ScanDocument } from '@/domain/scan/scan.generated';

import { scanValidator } from './scan-format';

vi.mock(import('server-only'), () => ({}));

function actionFixture(): ScanDocument {
  const document = scanFixture();
  const unresolved: Answer = { state: 'unresolved', reason: 'unsupported', gap: 'gap:unknown' };
  const support: [string, ...string[]] = ['source:handler'];
  document.actors.push({
    id: 'actor:customer',
    kind: 'actor',
    name: 'Customer',
    authority: 'authored',
    support,
  });
  document.surfaces.push({
    id: 'surface:form',
    kind: 'surface',
    name: 'Form',
    type: 'page',
    states: ['pending', 'ready'],
    support,
  });
  document.controls.push({
    id: 'control:submit',
    kind: 'control_binding',
    action: 'action:submit',
    surface: 'surface:form',
    state: 'ready',
    trigger: 'submit',
    source: 'source:handler',
    availability: unresolved,
    support,
  });
  document.actions.push({
    id: 'action:submit',
    kind: 'action',
    intent: 'Submit a request',
    actors: ['actor:customer'],
    controls: ['control:submit'],
    conditions: {
      eligibility: unresolved,
      authentication: unresolved,
      authorisation: unresolved,
      ownership: unresolved,
    },
    input: unresolved,
    executions: { state: 'supported', value: ['execution:submit'], support },
    outcomes: ['outcome:pending'],
    support,
  });
  document.outcomes.push({
    id: 'outcome:pending',
    kind: 'outcome',
    action: 'action:submit',
    result: 'pending',
    visibleState: { state: 'supported', value: ['surface:form'], support },
    effects: unresolved,
    timing: 'accepted',
    continuation: { kind: 'stay', surface: 'surface:form', state: 'pending' },
    support,
  });
  document.summaries.push({
    id: 'summary:submit',
    kind: 'summary',
    host: 'host:server',
    source: 'source:handler',
    implementation: 'implementation:submit',
    context: { arguments: [], captures: [], typeArguments: [], configuration: [], policy: [] },
    operations: [
      { kind: 'return', id: 'operation:return', source: 'source:handler', value: { kind: 'void' } },
    ],
    effects: unresolved,
    frontiers: [],
    support,
  });
  document.executions.push({
    id: 'execution:submit',
    kind: 'execution',
    action: 'action:submit',
    host: 'host:server',
    source: 'source:handler',
    operation: 'operation:return',
    guard: unresolved,
    target: { kind: 'local', summary: 'summary:submit', operation: 'operation:return' },
    inputMappings: [],
    outcomeMappings: [{ response: 'response:accepted', outcome: 'outcome:pending', support }],
    support,
  });
  document.journeys.push({
    id: 'journey:submit',
    kind: 'journey',
    actor: 'actor:customer',
    goal: 'Request accepted',
    authority: 'authored',
    steps: [{ action: 'action:submit', outcome: 'outcome:pending' }],
    transitions: [],
    support,
  });
  return document;
}

describe('actor/action execution bridge', () => {
  it('preserves pending visible outcomes independently from local void return', async () => {
    const document = actionFixture();
    expect((await scanValidator())(document)).toEqual(document);
  });

  it('rejects a journey actor that cannot perform the selected action', async () => {
    const document = actionFixture();
    const journey = document.journeys[0];
    if (journey === undefined) throw new Error('Missing journey');
    document.actors.push({
      kind: 'actor',
      id: 'actor:other',
      name: 'Other',
      authority: 'authored',
      support: ['source:handler'],
    });
    journey.actor = 'actor:other';
    const parse = await scanValidator();
    expect(() => parse(document)).toThrow('actor/action mismatch');
  });

  it('rejects an outcome from another action and an invalid visible state', async () => {
    const document = actionFixture();
    const outcome = document.outcomes[0];
    if (outcome === undefined) throw new Error('Missing outcome');
    outcome.action = 'action:other';
    outcome.continuation = { kind: 'stay', surface: 'surface:form', state: 'invented' };
    const parse = await scanValidator();
    expect(() => parse(document)).toThrow('action/outcome mismatch');
    expect(() => parse(document)).toThrow('continuation must select a surface state');
    expect(() => parse(document)).toThrow('response/outcome action mismatch');
  });

  it('rejects a UI control bound to a local branch operation and foreign host context', async () => {
    const document = actionFixture();
    const action = document.actions[0];
    const execution = document.executions[0];
    if (action === undefined || execution === undefined) throw new Error('Missing action');
    action.controls = ['operation:return'];
    execution.host = 'host:other';
    const parse = await scanValidator();
    expect(() => parse(document)).toThrow('must reference control_binding');
    expect(() => parse(document)).toThrow('source/host mismatch');
    expect(() => parse(document)).toThrow('local execution must match host and operation');
  });
  it('keeps authorisation distinct from eligibility and client availability', async () => {
    const document = actionFixture();
    const action = document.actions[0];
    const host = document.hosts[0];
    if (action === undefined || host === undefined) throw new Error('Missing fixture records');
    document.actorConstraints = [
      {
        kind: 'actor_constraint',
        id: 'constraint:authenticated',
        concern: 'authentication',
        authority: 'enforcement_bound',
        expression: {
          kind: 'predicate',
          source: 'source:handler',
          expression: 'identity != null',
          inputs: ['identity'],
        },
        support: ['source:handler'],
      },
    ];
    action.conditions.authentication = {
      state: 'supported',
      value: ['constraint:authenticated'],
      support: ['source:handler'],
    };
    const parse = await scanValidator();
    expect(parse(document)).toEqual(document);
    action.conditions.authorisation = action.conditions.authentication;
    expect(() => parse(document)).toThrow('actor condition concern mismatch');
    host.environment = 'browser';
    expect(() => parse(document)).toThrow(
      'client availability cannot establish server enforcement',
    );
  });
});
