import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';

import { migratedEvidenceId, normaliseEvidence } from '@/../tools/migrate-model/evidence';
import { repositoryGit } from '@/../tools/scan-repository-inventory';
import {
  ANALYSIS_FAMILIES,
  isEvidenceRecord,
  stringsIn,
  type EvidenceFamily,
  type EvidenceRecord,
} from '@/domain/evidence/evidence';
import { hasPrefix } from '@/domain/ids';
import type { ContractData } from '@/domain/model/contracts.generated';
import { modelRecord } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';
import { readPinnedSource } from '@/infrastructure/scan/scoped-source-git';
import {
  recordBytes,
  recordFiles,
  readRecords,
} from '@/infrastructure/scan-explorer/evidence-files';

type AnalysisFamily = Extract<EvidenceFamily, 'sources' | 'bindings' | 'summaries' | 'gaps'>;
type EvidenceFile = ContractData<'evidence', 'EvidenceFile'>;

interface AnalysisRequest {
  readonly receipt?: string | undefined;
  readonly repo: string;
  readonly repository: string;
  readonly commit: string;
  readonly requested: readonly string[];
  readonly present: ReadonlySet<string>;
  readonly files: ReadonlyMap<string, EvidenceFile>;
  readonly hosts: ReadonlySet<string>;
}

interface RecordToPromote {
  readonly family: AnalysisFamily;
  readonly value: EvidenceRecord;
}

function analysisFamily(family: string): family is AnalysisFamily {
  return family === 'sources' || ANALYSIS_FAMILIES.has(family);
}

async function fileDigest(file: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = recordBytes(file);
  stream.on('data', (bytes: Buffer) => {
    hash.update(bytes);
  });
  await finished(stream);
  return hash.digest('hex');
}

async function analysisFiles(receipt: string, input: AnalysisRequest) {
  const document = modelRecord(JSON.parse(await readFile(receipt, 'utf8')));
  const files = modelRecord(document?.files);
  if (document?.format !== 'groundwork-analysis-cache/v1' || files === null) {
    throw new Error('An analysis cache needs a receipt with its pinned file hashes.');
  }
  if (document.repo !== input.repo || document.commit !== input.commit) {
    throw new Error('The analysis cache belongs to another repository or commit.');
  }
  const available = await recordFiles(path.dirname(receipt));
  return Object.entries(files).map(([family, hash]) => {
    if (!analysisFamily(family) || typeof hash !== 'string' || !/^[a-f\d]{64}$/u.test(hash)) {
      throw new Error(`Invalid analysis cache receipt entry ${family}.`);
    }
    const file = available.get(family);
    if (file === undefined) throw new Error(`Missing analysis cache family ${family}.`);
    return { family, hash, file };
  });
}

async function cacheRecords(receipt: string, input: AnalysisRequest) {
  const records = new Map<string, RecordToPromote>();
  const replacements = new Map<string, string>();
  for (const { family, file, hash } of await analysisFiles(receipt, input)) {
    const actual = await fileDigest(file);
    if (!timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(hash, 'hex'))) {
      throw new Error(`Analysis cache file changed: ${file}.`);
    }
    for await (const value of readRecords(file)) {
      const id = migratedEvidenceId(input.repo, value.id);
      if (records.has(id)) throw new Error(`Duplicate cached analysis record ${id}.`);
      records.set(id, { family, value });
      replacements.set(value.id, id);
    }
  }
  return { records, replacements };
}

type Cache = Awaited<ReturnType<typeof cacheRecords>>;

function verifyPinnedFile(file: EvidenceFile, input: AnalysisRequest): void {
  const listing = repositoryGit(input.repository, [
    '--literal-pathspecs',
    'ls-tree',
    '-z',
    '--full-tree',
    input.commit,
    '--',
    file.path,
  ]).toString('utf8');
  const metadata = listing.split('\t')[0] ?? '';
  const [, kind, blob] = metadata.split(' ');
  if (kind !== 'blob' || blob !== file.blob) {
    throw new Error(`Cached file ${file.path} is not supported by the pinned tree.`);
  }
}

function validateSource(
  value: EvidenceRecord,
  input: AnalysisRequest,
  files: ReadonlyMap<string, EvidenceFile>,
) {
  const file = typeof value.file === 'string' ? files.get(value.file) : undefined;
  if (file === undefined || typeof value.host !== 'string' || !input.hosts.has(value.host)) {
    throw new Error(
      `Cached source ${value.id} has no verified file and host in the pinned repository.`,
    );
  }
  verifyPinnedFile(file, input);
  const [first, last] = Array.isArray(value.lines) ? value.lines : [];
  const count = readPinnedSource(input.repository, file.blob).split(/\r?\n/u).length;
  if (typeof first !== 'number' || typeof last !== 'number' || first > last || last > count) {
    throw new Error(`Cached source ${value.id} is outside the pinned file.`);
  }
}

async function promoteRecord(
  id: string,
  cache: Cache,
  input: AnalysisRequest,
): Promise<RecordToPromote> {
  const cached = cache.records.get(id);
  if (cached === undefined) {
    throw new Error(`Cited analysis record ${id} is absent from the selected cache.`);
  }
  const references = new Map<string, string>();
  for (const raw of stringsIn(cached.value)) {
    const mapped = cache.replacements.get(raw) ?? migratedEvidenceId(input.repo, raw);
    if (input.present.has(mapped) || cache.records.has(mapped)) references.set(raw, mapped);
  }
  const value = normaliseEvidence(cached.value, references, input.files);
  const check = await modelValidator('evidence', cached.family);
  if (!isEvidenceRecord(value) || !check(value)) {
    throw new Error(
      `Cited analysis record ${id} does not validate: ${JSON.stringify(check.errors)}`,
    );
  }
  if (cached.family === 'sources') {
    const files = new Map([...input.files.values()].map((file) => [file.id, file]));
    validateSource(value, input, files);
  }
  return { family: cached.family, value };
}

/** Promote only cited records and their support from a verified repository cache. */
export async function citedAnalysis(input: AnalysisRequest): Promise<readonly RecordToPromote[]> {
  const outstanding = [...new Set(input.requested)].filter((id) => !input.present.has(id));
  if (outstanding.length === 0) return [];
  if (input.receipt === undefined) {
    throw new Error(
      `Cited evidence is absent: ${outstanding.join(', ')}. Supply its pinned analysis receipt.`,
    );
  }
  const cache = await cacheRecords(input.receipt, input);
  const promoted = new Map<string, RecordToPromote>();
  const done = new Set(input.present);
  while (outstanding.length > 0) {
    const id = outstanding.pop();
    if (id === undefined || done.has(id)) continue;
    const entry = await promoteRecord(id, cache, input);
    done.add(id);
    promoted.set(id, entry);
    for (const reference of stringsIn(entry.value)) {
      if (hasPrefix(reference, 'ev') && !done.has(reference)) outstanding.push(reference);
    }
  }
  return [...promoted]
    .toSorted(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([, entry]) => entry);
}
