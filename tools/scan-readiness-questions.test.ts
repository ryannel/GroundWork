import { mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readReadinessQuestions } from './scan-readiness-questions';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'readiness-questions-'));
  folders.push(directory);
  const rows = Array.from({ length: 22 }, (_, index) => ({
    id: `Q${String(index + 1).padStart(2, '0')}`,
    question: `Frozen question ${String(index)}`,
    requiredEvidence: `Typed evidence ${String(index)}`,
    status: 'partial',
  }));
  const frozen = {
    format: 'answerability-review/v1',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
    questionCount: 22,
    supported: 0,
    partial: 22,
    unsupported: 0,
    questions: rows,
  };
  const supported = new Set([
    'Q01',
    'Q05',
    'Q07',
    'Q08',
    'Q12',
    'Q13',
    'Q14',
    'Q15',
    'Q16',
    'Q17',
    'Q18',
    'Q19',
    'Q20',
  ]);
  const questions = rows.map((row) => {
    if (row.id === 'Q21') return { ...row, status: 'unsupported' };
    return { ...row, status: supported.has(row.id) ? 'supported' : 'partial' };
  });
  const actual = { ...frozen, supported: 13, partial: 8, unsupported: 1, questions };
  const input = {
    review: path.join(directory, 'review.json'),
    frozen: path.join(directory, 'frozen.json'),
  };
  writeFileSync(input.review, JSON.stringify(actual));
  writeFileSync(input.frozen, JSON.stringify(frozen));
  return { input, actual, frozen };
}

describe('readiness frozen question evidence', () => {
  it('preserves the actual 13/8/1 source statuses in frozen question order', async () => {
    const { input, actual } = fixture();
    writeFileSync(
      input.review,
      JSON.stringify({ ...actual, questions: actual.questions.toReversed() }),
    );
    const result = await readReadinessQuestions(input);
    expect(result.counts).toEqual({ supported: 13, partial: 8, unsupported: 1 });
    expect(result.questions.find((row) => row.id === 'Q04')?.status).toBe('partial');
    expect(result.questions.find((row) => row.id === 'Q21')?.status).toBe('unsupported');
    expect(result.questionIds[0]).toBe('Q01');
    expect(result.questions[0]?.status).toBe('source-supported');
  });
  it('rejects changed wording, evidence and omitted or duplicate identities', async () => {
    const { input, actual } = fixture();
    for (const field of ['question', 'requiredEvidence'] as const) {
      writeFileSync(
        input.review,
        JSON.stringify({
          ...actual,
          questions: actual.questions.map((row, index) =>
            index === 0 ? { ...row, [field]: 'Easier question' } : row,
          ),
        }),
      );
      await expect(readReadinessQuestions(input)).rejects.toThrow('frozen question');
    }
    writeFileSync(
      input.review,
      JSON.stringify({ ...actual, questions: actual.questions.slice(1) }),
    );
    await expect(readReadinessQuestions(input)).rejects.toThrow('22');
    writeFileSync(
      input.review,
      JSON.stringify({
        ...actual,
        questions: actual.questions.map((row, index) =>
          index === 0 ? { ...row, id: 'Q02' } : row,
        ),
      }),
    );
    await expect(readReadinessQuestions(input)).rejects.toThrow('duplicate');
  });
  it('rejects false supported totals, unknown statuses and a different repository pin', async () => {
    const { input, actual } = fixture();
    writeFileSync(input.review, JSON.stringify({ ...actual, supported: 22 }));
    await expect(readReadinessQuestions(input)).rejects.toThrow('counts');
    writeFileSync(
      input.review,
      JSON.stringify({
        ...actual,
        questions: actual.questions.map((row) => ({ ...row, status: 'not_examined' })),
      }),
    );
    await expect(readReadinessQuestions(input)).rejects.toThrow('supported');
    writeFileSync(input.review, JSON.stringify({ ...actual, commit: 'b'.repeat(40) }));
    await expect(readReadinessQuestions(input)).rejects.toThrow('pin changed');
  });
  it('rejects unsupported actor promotion and an all-green source roster despite consistent totals', async () => {
    const { input, actual } = fixture();
    writeFileSync(
      input.review,
      JSON.stringify({
        ...actual,
        supported: 14,
        unsupported: 0,
        questions: actual.questions.map((row) =>
          row.id === 'Q21' ? { ...row, status: 'supported' } : row,
        ),
      }),
    );
    await expect(readReadinessQuestions(input)).rejects.toThrow('proof roster');
    writeFileSync(
      input.review,
      JSON.stringify({
        ...actual,
        supported: 22,
        partial: 0,
        unsupported: 0,
        questions: actual.questions.map((row) => ({ ...row, status: 'supported' })),
      }),
    );
    await expect(readReadinessQuestions(input)).rejects.toThrow('proof roster');
  });
  it('uses the bounded regular-file reader for both evidence inputs', async () => {
    const { input, actual } = fixture();
    rmSync(input.review);
    symlinkSync(input.frozen, input.review);
    await expect(readReadinessQuestions(input)).rejects.toThrow('bounded regular file');
    rmSync(input.review);
    writeFileSync(input.review, JSON.stringify(actual));
    truncateSync(input.frozen, 67_108_865);
    await expect(readReadinessQuestions(input)).rejects.toThrow('caller byte bound');
  });
});
