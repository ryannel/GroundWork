import 'server-only';

import type { ScanDocument } from '@/domain/scan/scan.generated';

import type { ScanScope } from './scan-scope';

/** The independent run manifest supplies the denominator, not the emitted receipts. */
export function assertScopeCoverage(scope: ScanScope, document: ScanDocument): void {
  for (const question of scope.questions) {
    const receipts = document.receipts.filter((receipt) => receipt.scope === question.id);
    if (receipts.length !== 1 || receipts[0]?.profile !== question.profile) {
      throw new Error(`Missing or duplicate expected question ${question.id}`);
    }
  }
  const expected = new Set(scope.questions.map((question) => question.id));
  if (document.receipts.some((receipt) => !expected.has(receipt.scope))) {
    throw new Error('Capture contains a question outside the accepted scope');
  }
  const paths = new Set(scope.files.map((file) => file.path));
  if (
    document.sources.some(
      (source) =>
        source.repo !== scope.repo || source.commit !== scope.commit || !paths.has(source.path),
    )
  ) {
    throw new Error('Source evidence is outside the pinned scope');
  }
}
