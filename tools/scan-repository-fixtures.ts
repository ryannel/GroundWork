import { createHash } from 'node:crypto';

import {
  canonicalDataLiteral,
  storybookConfiguration,
} from '@/infrastructure/scan/canonical-data-fixture';

import type { RepositoryFile } from './scan-repository-inventory';

const LIMIT = 8 * 1024 * 1024;
function textOf(
  file: RepositoryFile | undefined,
  limit: number,
  read: (blob: string, sizeOnly: boolean) => Buffer,
): string | undefined {
  if (file?.kind !== 'blob' || !['100644', '100755'].includes(file.mode)) return undefined;
  const size = Number(read(file.blob, true).toString('utf8').trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > limit) return undefined;
  const body = read(file.blob, false);
  const text = body.toString('utf8');
  return body.length === size && Buffer.from(text).equals(body) ? text : undefined;
}
function classify(input: {
  readonly file: RepositoryFile;
  readonly files: ReadonlyMap<string, RepositoryFile>;
  readonly commit: string;
  readonly read: (blob: string, sizeOnly: boolean) => Buffer;
}): RepositoryFile {
  const { file } = input;
  const matched = /^(.*(?:^|\/)\.storybook)\/mocks\/.+\.ts$/u.exec(file.path);
  if (matched === null || file.language !== 'typescript') return file;
  const config = input.files.get(`${matched[1] ?? ''}/main.ts`);
  const configText = textOf(config, 64 * 1024, input.read);
  if (configText === undefined || config === undefined) return file;
  if (!storybookConfiguration(config.path, configText)) return file;
  const text = textOf(file, LIMIT, input.read);
  if (text === undefined) return file;
  const proof = canonicalDataLiteral(file.path, text);
  if (proof === undefined) return file;
  return {
    ...file,
    category: 'test',
    language: null,
    selectedForParsing: false,
    reason:
      'Whole-file canonical data fixture in source-backed Storybook mocks. Static literal proof replaces executable graph lowering; original full bytes and Git identity are retained. This sample is not an effective wire contract.',
    canonicalData: {
      classification: 'canonical_data_fixture',
      canonicalTextLimitBytes: LIMIT,
      commit: input.commit,
      sha256: createHash('sha256').update(text).digest('hex'),
      lines: proof.lines,
      parser: proof.parser,
      literalNodes: proof.literalNodes,
      storybookConfig: { path: config.path, blob: config.blob },
      contractObligation:
        'Sample data only: declared schema, resolver binding, effective wire coercion and production contract compatibility remain unproved.',
    },
  };
}

/** Candidate paths alone never establish data purity or justify omitting executable source. */
export function canonicalDataFixtures(input: {
  readonly files: readonly RepositoryFile[];
  readonly commit: string;
  readonly read: (blob: string, sizeOnly: boolean) => Buffer;
}): readonly RepositoryFile[] {
  const files = new Map(input.files.map((file) => [file.path, file]));
  return input.files.map((file) =>
    classify({ file, files, commit: input.commit, read: input.read }),
  );
}
