import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { adoptRepositoryPass } from './scan-repository-adopt';
import { verifyAdoptionSource } from './scan-repository-adopt-checker';
import { scanRepositoryPass } from './scan-repository-pass';
import {
  overwritePassJson,
  passFixture,
  passJson,
  passState,
} from './scan-repository-pass-fixture';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./scan-repository-adopt-checker'), { spy: true });
const fixtures: ReturnType<typeof passFixture>[] = [];
function fixture(files?: Readonly<Record<string, string>>) {
  const input = passFixture(files);
  fixtures.push(input);
  return input;
}
afterEach(() => {
  for (const input of fixtures.splice(0)) input.dispose();
});
function args(input: ReturnType<typeof passFixture>): readonly string[] {
  return [input.output, path.join(input.root, 'adopted'), input.root, process.cwd()];
}

describe('verified repository checkpoint adoption', () => {
  it('preserves original native artefacts and source checkpoint while publishing bounded metric references', async () => {
    const input = fixture();
    await scanRepositoryPass(input.args);
    const before = readFileSync(path.join(input.output, 'run-state.json'), 'utf8');
    const state = passState(input.output);
    const document = state.completed[0]?.artifacts.find((a) =>
      a.path.endsWith('/document.json'),
    )?.path;
    if (document === undefined) throw new Error('Missing fixture document');
    await adoptRepositoryPass(args(input));
    const adopted = path.join(input.root, 'adopted');
    expect(passState(adopted).status).toBe('source_complete');
    expect(passJson(path.join(adopted, 'repository.json'))).toMatchObject({
      format: 'scan-repository/v2',
      runStatus: 'source_complete',
      shardCount: 2,
    });
    expect(readFileSync(path.join(adopted, document))).toEqual(
      readFileSync(path.join(input.output, document)),
    );
    expect(readFileSync(path.join(input.output, 'run-state.json'), 'utf8')).toBe(before);
    expect(passJson(path.join(adopted, 'adoption.json'))).toMatchObject({
      adoptedShards: 2,
      sourceVerification: { source: input.output },
    });
  }, 30_000);

  it('recovers complete verified tasks after aggregate publication failed without trusting the failed aggregate', async () => {
    const input = fixture();
    await scanRepositoryPass(input.args);
    const state = passState(input.output);
    overwritePassJson(path.join(input.output, 'run-state.json'), {
      ...state,
      status: 'running',
      reportDigest: null,
    });
    writeFileSync(path.join(input.output, 'repository.json'), 'rejected incomplete aggregate');
    await adoptRepositoryPass(args(input));
    expect(passState(path.join(input.root, 'adopted')).completed).toEqual(state.completed);
    expect(readFileSync(path.join(input.output, 'repository.json'), 'utf8')).toBe(
      'rejected incomplete aggregate',
    );
  }, 30_000);

  it('rejects incomplete tasks before creating an adopted selection', async () => {
    const input = fixture();
    await scanRepositoryPass([...input.args, '--stop-after', '1']);
    await expect(adoptRepositoryPass(args(input))).rejects.toThrow('incomplete');
    expect(existsSync(path.join(input.root, 'adopted'))).toBe(false);
  }, 30_000);

  it('rejects changed native artefacts and never replaces an original capture', async () => {
    const input = fixture();
    await scanRepositoryPass(input.args);
    await expect(
      adoptRepositoryPass([input.output, input.output, input.root, process.cwd()]),
    ).rejects.toThrow('separate');
    const task = passState(input.output).completed[0];
    const artifact = task?.artifacts.find((a) => a.path.endsWith('/document.json'));
    if (!artifact) throw new Error('Missing fixture artifact');
    writeFileSync(path.join(input.output, artifact.path), '{}');
    await expect(adoptRepositoryPass(args(input))).rejects.toThrow(/changed|digest|artifact/u);
    expect(existsSync(path.join(input.root, 'adopted'))).toBe(false);
  }, 30_000);

  it('preserves a complete zero-parser canonical capture without inventing native tasks', async () => {
    const input = fixture({ 'README.md': 'Canonical context only\n' });
    await scanRepositoryPass(input.args);
    await adoptRepositoryPass(args(input));
    const adopted = path.join(input.root, 'adopted');
    expect(passState(adopted).completed).toEqual([]);
    expect(passJson(path.join(adopted, 'repository.json'))).toMatchObject({
      selectedFiles: 0,
      trackedFiles: 1,
      trials: [],
    });
  }, 30_000);
  it('verifies every retained path while copying identical canonical bodies only once', async () => {
    const input = fixture({ 'README.md': 'Same context\n', 'GUIDE.md': 'Same context\n' });
    await scanRepositoryPass(input.args);
    await adoptRepositoryPass(args(input));
    expect(passState(path.join(input.root, 'adopted')).status).toBe('source_complete');
  }, 30_000);

  it('rejects substituted canonical bytes even when the retained length stays unchanged', async () => {
    const input = fixture({ 'README.md': 'Pinned context\n' });
    await scanRepositoryPass(input.args);
    const files = readdirSync(path.join(input.output, 'ancillary'));
    const name = files[0];
    if (name === undefined) throw new Error('Missing canonical fixture');
    const file = path.join(input.output, 'ancillary', name);
    writeFileSync(file, 'x'.repeat(readFileSync(file).length));
    await expect(adoptRepositoryPass(args(input))).rejects.toThrow('pinned Git blob');
    expect(existsSync(path.join(input.root, 'adopted', 'adoption.json'))).toBe(false);
  }, 30_000);

  it('keeps the copied checkpoint nonterminal if the verified adoption receipt cannot be written', async () => {
    const input = fixture();
    await scanRepositoryPass(input.args);
    const verifier = vi.mocked(verifyAdoptionSource);
    const { verifyAdoptionSource: original } = await vi.importActual<{
      verifyAdoptionSource: typeof verifyAdoptionSource;
    }>('./scan-repository-adopt-checker');
    verifier.mockImplementationOnce(original).mockImplementationOnce((request) => {
      const proof = original(request);
      writeFileSync(path.join(request.source, 'adoption.json'), 'receipt collision');
      return proof;
    });
    await expect(adoptRepositoryPass(args(input))).rejects.toThrow('EEXIST');
    expect(passState(path.join(input.root, 'adopted'))).toMatchObject({
      status: 'stopped',
      reportDigest: null,
    });
  }, 30_000);
});
