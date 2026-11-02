import path from 'node:path';

import { nccActionMetadata } from '@/infrastructure/scan/generated-action-metadata';

import type { RepositoryFile } from './scan-repository-inventory';

function regular(file: RepositoryFile | undefined): file is RepositoryFile {
  return file?.kind === 'blob' && ['100644', '100755'].includes(file.mode);
}

function metadata(
  file: RepositoryFile | undefined,
  read: (blob: string, sizeOnly: boolean) => Buffer,
): string | undefined {
  if (!regular(file)) return undefined;
  const size = Number(read(file.blob, true).toString('utf8').trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > 65_536) return undefined;
  const bytes = read(file.blob, false);
  const text = bytes.toString('utf8');
  return bytes.length === size && !bytes.includes(0) && Buffer.from(text).equals(bytes)
    ? text
    : undefined;
}

export function generatedNccActionProof(input: {
  readonly candidate: RepositoryFile;
  readonly files: ReadonlyMap<string, RepositoryFile>;
  readonly read: (blob: string, sizeOnly: boolean) => Buffer;
}): string | undefined {
  const directory = /^(\.github\/actions\/[^/]+)\/dist(?:\/[\w-]+)?\/index\.js$/u.exec(
    input.candidate.path,
  )?.[1];
  if (directory === undefined || !regular(input.candidate)) return undefined;
  const declarations = ['action.yml', 'package.json'].map((name) =>
    input.files.get(`${directory}/${name}`),
  );
  const [action, manifest] = declarations.map((file) => metadata(file, input.read));
  if (action === undefined || manifest === undefined) return undefined;
  const recipe = nccActionMetadata(action, manifest);
  if (recipe === undefined || `${directory}/${recipe.main}` !== input.candidate.path) {
    return undefined;
  }
  const source = input.files.get(path.posix.join(directory, recipe.input));
  if (
    !regular(source) ||
    !source.selectedForParsing ||
    !['typescript', 'javascript'].includes(source.language ?? '')
  ) {
    return undefined;
  }
  const anchors = [...declarations, source].map(
    (file) => `${file?.path ?? ''}@${file?.blob ?? ''}`,
  );
  return `Generated CI action bundle: pinned node action entry and static NCC build declaration map original source to this output. Excluded from application parsing; complete tree entry retained under ancillary byte limits. Source/recipe evidence: ${anchors.join(', ')}. Build reproducibility, complete dependency closure and runtime equivalence remain unproved.`;
}
