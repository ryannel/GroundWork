import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoveryHostFixture } from '@/../test/scan-discovery-host-kit';
import type {
  DiscoveryReviewIdentity,
  DiscoveryReviewReceipt,
} from '@/domain/scan/discovery-review-types';

import { checkDiscovery } from './scan-discovery';
import { readDiscoveryInput } from './scan-discovery-io';
import { discoveryReviewOptions } from './scan-discovery-review';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./scan-discovery-io'), () => ({
  readDiscoveryInput: vi.fn<typeof readDiscoveryInput>(),
}));

const directories: string[] = [];
interface ValidationResult {
  readonly status: string;
  readonly investigationCoverage: { readonly status: string };
  readonly reviewIdentity: DiscoveryReviewIdentity;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'groundwork-review-cli-'));
  directories.push(directory);
  const { input, document } = discoveryHostFixture();
  input.interpretation.runs[0]!.author_ids = ['author:fixture'];
  const interpretation = path.join(directory, 'interpretation.json');
  const discovery = path.join(directory, 'discovery.json');
  await Promise.all([
    writeFile(interpretation, JSON.stringify(input.interpretation)),
    writeFile(discovery, JSON.stringify(document)),
  ]);
  vi.mocked(readDiscoveryInput).mockResolvedValue(input);
  const output = vi.spyOn(console, 'log').mockImplementation(vi.fn<typeof console.log>());
  const args = ['inventory.json', interpretation, 'inputs.json', discovery];
  const readResult = (): ValidationResult =>
    JSON.parse(String(output.mock.lastCall?.[0])) as ValidationResult;
  return { args, directory, input, readResult };
}

function review(identity: DiscoveryReviewIdentity): DiscoveryReviewReceipt {
  return {
    format: 'scan-discovery-review/v1',
    identity,
    reviewer_id: 'reviewer:fixture',
    reviewer_run_id: 'review-run:fixture',
    independence: {
      state: 'declared',
      independent_of_author_ids: identity.author_ids,
      independent_of_author_run_ids: identity.author_run_ids,
    },
    examined: identity.scope,
    verdict: 'accepted',
    findings: [],
  };
}

describe('discovery CLI completion gate', () => {
  it('keeps valid partial publishing available while strict completion needs review', async () => {
    const example = await fixture();
    await expect(checkDiscovery(example.args)).resolves.toBe(true);
    expect(example.readResult()).toMatchObject({
      status: 'review_required',
      investigationCoverage: { status: 'complete' },
    });
    await expect(checkDiscovery([...example.args, '--require-complete'])).resolves.toBe(false);
  });

  it('requires a matching independent receipt for strict completion', async () => {
    const example = await fixture();
    await checkDiscovery(example.args);
    const receipt = review(example.readResult().reviewIdentity);
    const filename = path.join(example.directory, 'review.json');
    await writeFile(filename, JSON.stringify(receipt));
    await expect(
      checkDiscovery([...example.args, '--require-complete', '--review', filename]),
    ).resolves.toBe(true);
    expect(example.readResult().status).toBe('complete');
    for (const mutation of [
      { ...receipt, reviewer_id: 'author:fixture' },
      { ...receipt, identity: { ...receipt.identity, discovery_sha256: '0'.repeat(64) } },
      { ...receipt, examined: { ...receipt.examined, component_ids: [] } },
      { ...receipt, independence: { ...receipt.independence, state: 'orchestration_verified' } },
    ]) {
      await writeFile(filename, JSON.stringify(mutation));
      await expect(
        checkDiscovery([...example.args, '--review', filename, '--require-complete']),
      ).resolves.toBe(false);
    }
  });

  it('does not derive known authors from run names when any author identity is missing', async () => {
    const example = await fixture();
    delete example.input.interpretation.runs[0]!.author_ids;
    await writeFile(example.args[1]!, JSON.stringify(example.input.interpretation));
    await checkDiscovery(example.args);
    expect(example.readResult().reviewIdentity.author_ids).toEqual([]);
  });

  it.each([
    ['--review'],
    ['--unknown'],
    ['--require-complete', '--require-complete'],
    ['--review', 'one.json', '--review', 'two.json'],
    ['--review', '--require-complete'],
  ])('rejects invalid or repeated options %j', (...options) => {
    expect(() => discoveryReviewOptions(options)).toThrow('Expected');
  });
});
