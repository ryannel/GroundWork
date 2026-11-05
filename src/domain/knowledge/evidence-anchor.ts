import { permalinkOf } from '@/domain/code-links';

import type { Evidence } from './knowledge.generated';

/** A derived permalink never replaces the commit, path and range in canonical evidence. */
export function evidenceAnchor(record: Evidence): string | null {
  if (record.host === undefined) return null;
  return permalinkOf(record, { host: record.host, encoding: 'segments', range: 'always' });
}
