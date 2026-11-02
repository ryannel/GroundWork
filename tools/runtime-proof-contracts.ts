import type {
  InterfaceContract,
  KnowledgeRecord,
  Shape,
} from '@/domain/knowledge/knowledge.generated';

import { compactSources, gapLines, sourceLinks } from './runtime-proof-sources';
import { html } from './runtime-proof-view';

type Records = ReadonlyMap<string, KnowledgeRecord>;
function fieldLine(field: Shape['fields'][number], shape: Shape, records: Records): string {
  const optionality = field.optional === true ? ' · optional' : ' · required';
  const optional = field.optional === undefined ? '' : optionality;
  const tag = field.wireTag === undefined ? '' : ` · tag ${String(field.wireTag)}`;
  const constraint = field.maxLength === undefined ? '' : ` · max ${String(field.maxLength)}`;
  const pattern = field.pattern === undefined ? '' : ` · ${field.pattern}`;
  const title = `${field.name}: ${field.type}${optional}${nullability(field.nullable)}${tag}${constraint}${pattern}${literalConstraints(field)}`;
  return `<div class="field"><span>${html(title)}</span>${compactSources(field.evidence ?? shape.evidence, records)}</div>`;
}
function nullability(value: boolean | undefined): string {
  if (value === undefined) return '';
  return value ? ' · nullable' : ' · non-null';
}
function literalConstraints(field: Shape['fields'][number]): string {
  const allowed = field.enum === undefined ? '' : ` · enum ${JSON.stringify(field.enum)}`;
  const fixed = field.const === undefined ? '' : ` · const ${JSON.stringify(field.const)}`;
  return allowed + fixed;
}
function extraProperties(shape: Shape): string {
  if (shape.additionalProperties === undefined) return '';
  return `<p class="muted">Additional properties: ${shape.additionalProperties ? 'permitted' : 'forbidden'}</p>`;
}
function nestedShape(records: Records, id: string, seen: ReadonlySet<string>): string {
  const shape = records.get(id);
  if (shape?.kind !== 'shape') return `<p>Schema ${html(id)} pending</p>`;
  if (seen.has(id)) return `<p>↪ ${html(shape.label)} (recursive reference)</p>`;
  const next = new Set([...seen, id]);
  const fields = shape.fields
    .map((field) => {
      const nested = field.shape === undefined ? '' : nestedShape(records, field.shape, next);
      return fieldLine(field, shape, records) + nested;
    })
    .join('');
  const items =
    shape.items === undefined
      ? ''
      : `<div class="nested"><strong>[] items</strong>${nestedShape(records, shape.items, next)}</div>`;
  const reserved =
    shape.reservedTags === undefined
      ? ''
      : `<p class="muted">Reserved tags: ${shape.reservedTags.map(String).join(', ')} · ${html((shape.reservedNames ?? []).join(', '))}</p>`;
  const caption = `${shape.representation} · ${shape.encoding ?? 'source type'} · ${shape.completeness}`;
  const wireType = shape.wireType === undefined ? '' : ` · ${html(shape.wireType)}`;
  return `<div class="shape"><h4>${html(shape.label)}</h4><p class="muted">${html(caption)}${wireType}</p>${extraProperties(shape)}${fields}${items}${reserved}${sourceLinks(shape.evidence, records)}${gapLines(shape.gaps, records)}</div>`;
}
function partView(part: InterfaceContract['request'][number], records: Records): string {
  const primary =
    part.shape === null
      ? '<p class="muted">Effective schema unresolved</p>'
      : nestedShape(records, part.shape, new Set());
  const content = part.presence === 'none' ? '<p>None — explicitly absent in source</p>' : primary;
  const source =
    part.sourceShape === null
      ? ''
      : `<details><summary>Source DTO or construction</summary>${nestedShape(records, part.sourceShape, new Set())}</details>`;
  return `<div class="contract-part"><h3>${html(part.part)} · ${html(part.presence)}</h3>${content}${source}${sourceLinks(part.evidence, records)}${gapLines(part.gaps, records)}</div>`;
}
export function contractView(
  contract: InterfaceContract,
  records: Records,
  seen: ReadonlySet<string> = new Set(),
): string {
  if (seen.has(contract.id)) return '<p>Recursive candidate reference</p>';
  const next = new Set([...seen, contract.id]);
  const request = [...contract.request]
    .toSorted((a, b) => partOrder(a.part) - partOrder(b.part))
    .map((part) => partView(part, records))
    .join('');
  const responses = contract.responses
    .map(
      (response) =>
        `<div><h3>${html(response.status)}</h3><p>${html(response.meaning)}</p>${partView(response.body, records)}</div>`,
    )
    .join('');
  const candidates = (contract.candidates ?? [])
    .map((id) => {
      const candidate = records.get(id);
      if (candidate?.kind !== 'interface_contract') return '<p>Candidate schema pending</p>';
      return `<details class="candidate"><summary>Candidate only · excluded from runtime binding</summary>${contractView(candidate, records, next)}</details>`;
    })
    .join('');
  const route = contractRoute(contract);
  return `<article><h2>${html(contract.name)}</h2><p class="muted">${html(contract.protocol)} · ${html(contract.authority.replaceAll('_', ' '))} · ${html(route)}</p><div class="contract-columns"><div><h3>Request / message</h3>${request}</div><div><h3>Response</h3>${responses.length === 0 ? '<p class="muted">No request/response body is established for this interaction.</p>' : responses}</div></div>${sourceLinks(contract.evidence, records)}${gapLines(contract.gaps, records)}${candidates}</article>`;
}

function partOrder(part: string): number {
  return ['message', 'body', 'record'].includes(part) ? 0 : 1;
}
function contractRoute(contract: InterfaceContract): string {
  const route = [contract.method, contract.path].filter((item) => item !== null).join(' ');
  if (route.length > 0) return route;
  if (contract.protocol === 'http') return 'HTTP route unresolved';
  return contract.protocol === 'kafka'
    ? 'Message contract'
    : 'Storage or unresolved transport contract';
}
