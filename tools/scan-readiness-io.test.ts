import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import accepted from '@/../docs/scan-trials/customer-service-archival/answerability.json' with { type: 'json' };
import actualWorkflow from '@/../test/fixtures/scan/readiness-workflow.json' with { type: 'json' };

import { verifyReadinessNative } from './scan-readiness-native';
import {
  verifyRegressionCheckers,
  verifyRegressionMutations,
  verifyRegressionProofs,
} from './scan-readiness-regression-guards';
import { readinessWorkflow } from './scan-readiness-workflow';

vi.mock(import('server-only'), () => ({}));
function workflow() {
  return structuredClone(actualWorkflow);
}

describe('readiness IO cannot trust green summaries alone', () => {
  it('requires the exact local workflow file and assertion roster', () => {
    const valid = workflow();
    expect(readinessWorkflow(valid, 'fixture.json').every((entry) => entry.passed)).toBe(true);
    const truncated = {
      ...valid,
      testResults: valid.testResults.map((file) => ({
        ...file,
        assertionResults: file.assertionResults.slice(0, 1),
      })),
    };
    expect(readinessWorkflow(truncated, 'fixture.json').every((entry) => entry.passed)).toBe(false);
    const foreign = {
      ...valid,
      testResults: valid.testResults.map((file) => ({
        ...file,
        name: path.join(process.cwd(), 'foreign', path.relative(process.cwd(), file.name)),
      })),
    };
    expect(readinessWorkflow(foreign, 'fixture.json').every((entry) => entry.passed)).toBe(false);
    expect(
      readinessWorkflow(
        { ...valid, testResults: valid.testResults.map((file) => ({ ...file, status: 'failed' })) },
        'fixture.json',
      ).every((entry) => entry.passed),
    ).toBe(false);
  });
  it('rejects incomplete checker fingerprints even if every supplied digest is current', async () => {
    await expect(verifyRegressionCheckers([])).rejects.toThrow('roster');
    await expect(
      verifyRegressionCheckers([{ path: 'tools/scan-archival-review.ts', digest: 'a'.repeat(64) }]),
    ).rejects.toThrow('roster');
  });
  it('requires the frozen 225 mutant identities, positive baselines and actual application', () => {
    const groups = accepted.reviewEvidence.mutations;
    expect(() => {
      verifyRegressionMutations(groups);
    }).not.toThrow();
    expect(() => {
      verifyRegressionMutations({
        ...groups,
        orders: groups.orders.map((row) => ({ ...row, applied: false })),
      });
    }).toThrow('unapplied');
    expect(() => {
      verifyRegressionMutations({
        ...groups,
        archival: groups.archival.map((row) => ({ ...row, baselinePassed: false })),
      });
    }).toThrow('baseline');
    expect(() => {
      verifyRegressionMutations({
        ...groups,
        events: groups.events.map((row) => ({ ...row, name: `${row.name} substituted` })),
      });
    }).toThrow('identities');
    expect(() => {
      verifyRegressionMutations({ ...groups, messages: groups.messages.slice(1) });
    }).toThrow('missing');
  });
  it('requires supported earlier and whole-question proofs with actual clauses', () => {
    const questions = accepted.proofs;
    expect(() => {
      verifyRegressionProofs({ questions, existing: accepted.proofs.existing });
    }).not.toThrow();
    expect(() => {
      verifyRegressionProofs({
        questions: { ...questions, q20: { supported: true, clauses: {} } },
        existing: accepted.proofs.existing,
      });
    }).toThrow('clause');
    expect(() => {
      verifyRegressionProofs({
        questions: { ...questions, q12: { supported: false } },
        existing: accepted.proofs.existing,
      });
    }).toThrow('unsupported');
  });
  it('rejects a native success summary without the complete seven-probe roster', async () => {
    await expect(
      verifyReadinessNative(
        {
          allSupported: true,
          q08DefaultSupported: true,
          q08DefaultMutations: 8,
          sourceCapture: path.resolve('test/source.json'),
          probes: [],
        },
        path.resolve('test/native.json'),
        path.resolve('test/source.json'),
      ),
    ).rejects.toThrow('summary');
  });
});
