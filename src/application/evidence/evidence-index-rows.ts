import { type EvidenceRecord, fieldsOf, stringsIn } from '@/domain/evidence/evidence';

// How a record appears in the evidence index: a short label to list and search it by, the file and lines it
// cites, and its links to the other records it names.

export interface IndexedRecord {
  readonly id: string;
  readonly family: string;
  readonly kind: string;
  readonly label: string;
  readonly path: string | null;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
  /** Long text worth searching: claim statements and reasoning, gap descriptions. */
  readonly text: string;
}

export interface RecordLink {
  readonly from: string;
  readonly field: string;
  readonly to: string;
}

export interface CitedLines {
  readonly path: string;
  readonly lines: readonly [number, number] | null;
}

const LABEL_LIMIT = 160;
const word = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
const clipped = (value: string): string =>
  value.length > LABEL_LIMIT ? `${value.slice(0, LABEL_LIMIT - 1)}…` : value;

function route(record: EvidenceRecord): string | null {
  const template = word(record.template);
  if (template === null) return null;
  const methods = Array.isArray(record.httpMethods) ? record.httpMethods.join(',') : '';
  return `${methods} /${template.replace(/^\//u, '')}`.trim();
}

const shapeName = (record: EvidenceRecord): string | null => {
  const shape = fieldsOf(record.shape);
  return word(shape.spelling) ?? word(shape.name);
};

/** The first of a record's naming fields it has, in the order a reader would look for them. */
export function recordLabel(record: EvidenceRecord): string {
  const candidates = [
    route(record),
    word(record.name),
    word(record.fq_name),
    word(record.symbol),
    word(record.implementation),
    word(record.statement),
    word(record.path),
    shapeName(record),
    word(record.component),
    word(record.reason),
  ];
  return clipped(candidates.find((value) => value !== null) ?? record.id);
}

function searchText(record: EvidenceRecord): string {
  return [record.statement, record.reasoning, record.description, record.goal]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

const pair = (value: unknown): readonly [number, number] | null =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number'
    ? [value[0], value[1]]
    : null;

/** The file and lines each source record cites, by source id. */
export function citedLines(sources: readonly EvidenceRecord[]): ReadonlyMap<string, CitedLines> {
  return new Map(
    sources.flatMap((source) => {
      const file = word(source.path);
      return file === null ? [] : [[source.id, { path: file, lines: pair(source.lines) }] as const];
    }),
  );
}

function cited(
  record: EvidenceRecord,
  sources: ReadonlyMap<string, CitedLines>,
): CitedLines | null {
  const own = word(record.path);
  if (own !== null) return { path: own, lines: pair(record.lines) };
  const source = typeof record.source === 'string' ? sources.get(record.source) : undefined;
  return source ?? null;
}

export function indexedRecord(
  family: string,
  record: EvidenceRecord,
  sources: ReadonlyMap<string, CitedLines>,
): IndexedRecord {
  const lines = cited(record, sources);
  return {
    id: record.id,
    family,
    kind: record.kind,
    label: recordLabel(record),
    path: lines?.path ?? null,
    lineStart: lines?.lines?.[0] ?? null,
    lineEnd: lines?.lines?.[1] ?? null,
    text: searchText(record),
  };
}

/** The records this one names, by the top-level field that names them. Only ids the repository holds count. */
export function recordLinks(record: EvidenceRecord, known: ReadonlySet<string>): RecordLink[] {
  const links: RecordLink[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (field === 'id' || field === 'kind') continue;
    for (const target of stringsIn(value)) {
      if (target !== record.id && known.has(target)) {
        links.push({ from: record.id, field, to: target });
      }
    }
  }
  return links;
}
