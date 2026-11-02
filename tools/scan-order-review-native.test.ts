import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { ScanDocument } from '@/domain/scan/scan.generated';

import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';
import { bindingReviewSelection } from './scan-bindings-selection';
import { orderQuestionProof } from './scan-order-review';
import { orderReviewMutations } from './scan-order-review-mutations';

vi.mock(import('server-only'), () => ({}));
const CAPTURE = process.env.GROUNDWORK_ARCHIVAL_CAPTURE;

function bounded(document: ScanDocument): ScanDocument {
  const ids = bindingReviewSelection(document);
  expect(ids).toEqual([...ids].toSorted((left, right) => left.localeCompare(right)));
  const pages = bindingReviewPages(document, ids, {
    maxTotalRecords: 65_536,
    maxTotalBytes: 67_108_864,
  });
  expect(pages.every((page) => page.records.length <= 4 && page.limit !== 'oversized-record')).toBe(
    true,
  );
  expect(new Set(pages.flatMap((page) => page.records).map((record) => record.id)).size).toBe(
    ids.length,
  );
  return bindingReviewDocument(document.id, pages);
}

describe.runIf(CAPTURE !== undefined)('frozen Q19 source question', () => {
  it('proves every whole-question clause from current extracted records', () => {
    if (CAPTURE === undefined) throw new Error('Expected explicit archival capture');
    const document = JSON.parse(readFileSync(CAPTURE, 'utf8')) as ScanDocument;
    const proof = orderQuestionProof(document);
    expect(proof.clauses).toEqual(
      expect.objectContaining(
        Object.fromEntries(Object.keys(proof.clauses).map((key) => [key, true])),
      ),
    );
  }, 120_000);
  it('returns the same whole answer after bounded ID-sorted record pages', () => {
    if (CAPTURE === undefined) throw new Error('Expected explicit archival capture');
    const document = JSON.parse(readFileSync(CAPTURE, 'utf8')) as ScanDocument;
    expect(orderQuestionProof(bounded(document))).toEqual(orderQuestionProof(document));
  }, 120_000);
  it('rejects every applied destructive mutation from a passing baseline', () => {
    if (CAPTURE === undefined) throw new Error('Expected explicit archival capture');
    const document = JSON.parse(readFileSync(CAPTURE, 'utf8')) as ScanDocument;
    const results = orderReviewMutations(bounded(document));
    expect(results.length).toBeGreaterThanOrEqual(21);
    expect(
      results.filter((result) => !result.applied || !result.baselinePassed || !result.rejected),
    ).toEqual([]);
  }, 120_000);
});
