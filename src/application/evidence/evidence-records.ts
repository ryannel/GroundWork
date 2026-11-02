import {
  ANALYSIS_FAMILIES,
  EVIDENCE_FAMILIES,
  type EvidenceFamily,
  type EvidenceFields,
  type EvidenceRecord,
  isEvidenceRecord,
  PROCESS_FAMILIES,
  stringsIn,
} from '@/domain/evidence/evidence';

type Merged = ReadonlyMap<string, ReadonlyMap<string, EvidenceRecord>>;

/**
 * Records from a repository's scan documents, added one document at a time, by family and id; the first document
 * to name an id wins. The syntax graph is not held: each document's new syntax records are handed back, to be
 * written straight to the cache, since one repository's graph can outgrow memory.
 */
export interface EvidenceMerge {
  /** Adds a document's records; returns its syntax records not seen before. */
  readonly add: (document: EvidenceFields) => readonly EvidenceRecord[];
  readonly merged: Merged;
}

const SEEN_SHARDS = 64;

/** Ids seen so far, spread over several sets: one set holds at most 2^24 entries, and a monorepo's graph has more. */
function seenIds(): { readonly firstTime: (id: string) => boolean } {
  const shards = new Map<number, Set<string>>();
  const shardOf = (id: string): Set<string> => {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = Math.imul(hash, 31) + (id.codePointAt(index) ?? 0);
    }
    const key = Math.abs(hash % SEEN_SHARDS);
    const shard = shards.get(key) ?? new Set<string>();
    shards.set(key, shard);
    return shard;
  };
  return {
    firstTime: (id) => {
      const shard = shardOf(id);
      if (shard.has(id)) return false;
      shard.add(id);
      return true;
    },
  };
}

export function evidenceMerge(): EvidenceMerge {
  const families = new Map<string, Map<string, EvidenceRecord>>();
  const syntaxSeen = seenIds();
  const newSyntax = (records: readonly EvidenceRecord[]): EvidenceRecord[] => {
    const fresh = records.filter((record) => syntaxSeen.firstTime(record.id));
    return fresh.map((record) => storedRecord(record));
  };
  const add = (document: EvidenceFields): readonly EvidenceRecord[] =>
    Object.entries(document).flatMap(([family, value]) => {
      if (!Array.isArray(value)) return [];
      const records = value.filter(isEvidenceRecord);
      if (family === 'semantic') return newSyntax(records);
      const known = families.get(family) ?? new Map<string, EvidenceRecord>();
      families.set(family, known);
      for (const record of records) if (!known.has(record.id)) known.set(record.id, record);
      return [];
    });
  return { add, merged: families };
}

/** Records from several scan documents at once (see EvidenceMerge). */
export function mergeDocuments(documents: readonly EvidenceFields[]): Merged {
  const merge = evidenceMerge();
  for (const document of documents) merge.add(document);
  return merge.merged;
}

const SHARED = new Set(['repo', 'commit', 'syntax']);
const isLongText = (value: unknown): boolean =>
  typeof value === 'string' && (value.length > 120 || value.includes('\n'));

/**
 * A record as stored: without the repository and commit every record shares, and without code text, which is
 * read from the commit instead.
 */
export function storedRecord(record: EvidenceRecord): EvidenceRecord {
  const kept = Object.entries(record).filter(
    ([key, value]) => !SHARED.has(key) && !(key === 'name' && isLongText(value)),
  );
  return { ...Object.fromEntries(kept), kind: record.kind, id: record.id };
}

/** Every `source:` id a value names, at any depth. */
const namedSources = (value: unknown): Set<string> =>
  new Set([...stringsIn(value)].filter((text) => text.startsWith('source:')));

const byId = (left: EvidenceRecord, right: EvidenceRecord): number =>
  left.id.localeCompare(right.id, 'en');

const sorted = (records: readonly EvidenceRecord[]): EvidenceRecord[] =>
  records.map((record) => storedRecord(record)).toSorted(byId);

const FAMILY_NAMES: ReadonlySet<string> = new Set(EVIDENCE_FAMILIES);
const isEvidenceFamily = (family: string): family is EvidenceFamily => FAMILY_NAMES.has(family);

export interface SplitEvidence {
  readonly evidence: ReadonlyMap<EvidenceFamily, readonly EvidenceRecord[]>;
  /** Call-level analysis, with the source spans only it cites, for the analysis cache. */
  readonly analysis: ReadonlyMap<EvidenceFamily, readonly EvidenceRecord[]>;
  /** The source spans neither cites: the syntax graph's, for the cache. */
  readonly syntaxSources: readonly EvidenceRecord[];
}

function factFamilies(merged: Merged): Map<EvidenceFamily, EvidenceRecord[]> {
  const families = new Map<EvidenceFamily, EvidenceRecord[]>();
  for (const [family, records] of merged) {
    if (family === 'semantic' || family === 'sources' || PROCESS_FAMILIES.includes(family)) {
      continue;
    }
    if (!isEvidenceFamily(family)) throw new Error(`Unknown scan record family: ${family}`);
    if (records.size > 0) families.set(family, sorted([...records.values()]));
  }
  return families;
}

/**
 * Splits merged scan records into evidence (the facts, and the source spans they cite), call-level analysis (and
 * the spans only it cites) and the spans only the syntax graph cites. Process records are dropped.
 */
export function splitEvidence(merged: Merged): SplitEvidence {
  const evidence = new Map<EvidenceFamily, readonly EvidenceRecord[]>();
  const analysis = new Map<EvidenceFamily, readonly EvidenceRecord[]>();
  for (const [family, records] of factFamilies(merged)) {
    (ANALYSIS_FAMILIES.has(family) ? analysis : evidence).set(family, records);
  }
  const citedByFacts = namedSources([...evidence.values()]);
  const citedByAnalysis = namedSources([...analysis.values()]);
  const sources = sorted([...(merged.get('sources')?.values() ?? [])]);
  const factSources = sources.filter((source) => citedByFacts.has(source.id));
  const analysisSources = sources.filter(
    (source) => !citedByFacts.has(source.id) && citedByAnalysis.has(source.id),
  );
  if (factSources.length > 0) evidence.set('sources', factSources);
  if (analysisSources.length > 0) analysis.set('sources', analysisSources);
  const syntaxSources = sources.filter(
    (source) => !citedByFacts.has(source.id) && !citedByAnalysis.has(source.id),
  );
  return { evidence, analysis, syntaxSources };
}
