import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';

import { html } from './runtime-proof-view';

export function sourceLinks(
  ids: readonly string[],
  records: ReadonlyMap<string, KnowledgeRecord>,
): string {
  return [...new Set(ids)]
    .map((id) => {
      const record = records.get(id);
      if (record?.kind !== 'evidence') return `<span>Source ${html(id)} pending</span>`;
      const url = evidenceAnchor(record);
      if (url === null) return '<span>GitHub host unresolved</span>';
      const label = `${record.path}:${String(record.lines[0])}–${String(record.lines[1])} @ ${record.commit.slice(0, 10)}`;
      return `<a class="source" href="${html(url)}" target="_blank" rel="noopener noreferrer">${html(label)}</a>`;
    })
    .join('');
}
export function gapLines(
  ids: readonly string[],
  records: ReadonlyMap<string, KnowledgeRecord>,
): string {
  const lines = [...new Set(ids)].map((id) => {
    const record = records.get(id);
    return record?.kind === 'gap' ? record.reason : `${id} — supporting record pending`;
  });
  return lines.length === 0
    ? ''
    : `<details class="gaps"><summary>Unresolved (${String(lines.length)})</summary><p>${lines.map(html).join('</p><p>')}</p></details>`;
}

export function compactSources(
  ids: readonly string[],
  records: ReadonlyMap<string, KnowledgeRecord>,
): string {
  return [...new Set(ids)]
    .flatMap((id, index) => {
      const record = records.get(id);
      if (record?.kind !== 'evidence') return [];
      const url = evidenceAnchor(record);
      if (url === null) return [];
      const title = `${record.path}:${String(record.lines[0])}–${String(record.lines[1])} @ ${record.commit}`;
      const label = ids.length > 1 ? `source ${String(index + 1)} ↗` : 'source ↗';
      return [
        `<a class="field-source" href="${html(url)}" title="${html(title)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
      ];
    })
    .join(' ');
}
