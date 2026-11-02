import type { ExplorerManifest, ExplorerService, ExplorerArtifactIndex } from './service-explorer';

function object(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function filename(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*\.json$/u.test(value);
}
function byteCount(value: unknown): boolean {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2_097_152
  );
}
type Artifact = ExplorerManifest['artifacts'][number];
function plainArtifact(value: unknown): value is Omit<Artifact, 'pack'> {
  if (!object(value)) return false;
  const hash = typeof value.sha256 === 'string' && /^[a-f\d]{64}$/u.test(value.sha256);
  return filename(value.file) && byteCount(value.bytes) && hash;
}
function artifact(value: unknown): value is Artifact {
  if (!plainArtifact(value)) return false;
  if (!('pack' in value) || value.pack === undefined) return true;
  return plainArtifact(value.pack) && !('pack' in value.pack);
}
function artifactIndex(value: unknown): value is ExplorerArtifactIndex {
  if (!artifact(value) || !('bucket' in value)) return false;
  return typeof value.bucket === 'string' && /^[a-f\d]{2}$/u.test(value.bucket);
}
function entry(value: unknown): value is ExplorerService['entries'][number] {
  if (!object(value)) return false;
  return text(value.id) && text(value.label) && filename(value.file);
}
function purpose(value: unknown): value is ExplorerService['purpose'] {
  if (!object(value) || value.label !== 'Inferred') return false;
  return (
    text(value.statement) &&
    text(value.claim) &&
    ['low', 'medium', 'high'].includes(String(value.confidence))
  );
}
function service(value: unknown): value is ExplorerService {
  if (!object(value)) return false;
  const identity = [value.id, value.name, value.repo, value.commit].every(text);
  const pages = filename(value.overview) && filename(value.callers);
  const entries =
    Array.isArray(value.entries) && value.entries.length <= 500 && value.entries.every(entry);
  return identity && pages && entries && purpose(value.purpose);
}
function checkedList<T>(
  value: unknown,
  check: (item: unknown) => item is T,
  maximum: number,
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum || !value.every(check)) {
    throw new Error('Invalid explorer collection');
  }
  return value;
}
/** Browser-side structure checking follows digest verification of a selected manifest. */
export function checkedExplorerManifest(value: unknown): ExplorerManifest {
  if (!object(value) || value.format !== 'service-explorer/v1') {
    throw new Error('Invalid explorer manifest');
  }
  if (![value.workspace, value.snapshot].every(text)) throw new Error('Invalid explorer identity');
  const services = checkedList(value.services, service, 200);
  const artifacts = checkedList(value.artifacts, artifact, 10_000);
  const indexes =
    value.artifactIndexes === undefined
      ? {}
      : { artifactIndexes: checkedList(value.artifactIndexes, artifactIndex, 256) };
  return {
    format: value.format,
    workspace: String(value.workspace),
    snapshot: String(value.snapshot),
    services,
    artifacts,
    ...indexes,
  };
}
export function checkedExplorerIndex(value: unknown, snapshot: string): readonly Artifact[] {
  if (
    !object(value) ||
    value.format !== 'service-explorer-index/v1' ||
    value.snapshot !== snapshot
  ) {
    throw new Error('Explorer index snapshot changed');
  }
  const artifacts = checkedList(value.artifacts, artifact, 10_000);
  if (new Set(artifacts.map((item) => item.file)).size !== artifacts.length) {
    throw new Error('Duplicate explorer artifact');
  }
  return artifacts;
}

export function checkedPackPage(value: unknown, file: string): string {
  if (!object(value) || value.format !== 'service-explorer-pack/v1' || !object(value.pages)) {
    throw new Error('Invalid explorer pack');
  }
  if (Object.keys(value.pages).length > 1024) {
    throw new Error('Explorer pack member bound exceeded');
  }
  const page = value.pages[file];
  if (typeof page !== 'string') throw new Error('Artifact is outside its selected pack');
  return page;
}
