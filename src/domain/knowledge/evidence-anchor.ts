import type { Evidence } from './knowledge.generated';

/** A derived permalink never replaces the commit, path and range in canonical evidence. */
export function evidenceAnchor(record: Evidence): string | null {
  if (record.host === undefined) return null;
  const repo = record.repo.split('/').map(encodeURIComponent).join('/');
  const path = record.path.split('/').map(encodeURIComponent).join('/');
  return `https://${record.host}/${repo}/blob/${record.commit}/${path}#L${String(record.lines[0])}-L${String(record.lines[1])}`;
}
