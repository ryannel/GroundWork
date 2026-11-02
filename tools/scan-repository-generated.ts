import path from 'node:path';

import { generatedActionMetadata } from '@/infrastructure/scan/generated-action-metadata';

import { generatedActionEntries, generatedRecipeTokens } from './scan-repository-generated-config';
import { generatedNccActionProof } from './scan-repository-generated-ncc';
import type { RepositoryFile } from './scan-repository-inventory';

const METADATA_LIMIT = 64 * 1024;
const helperRecipe = `import { defineConfig } from 'rolldown';
/**
 * @param {Array<{ input: string, file: string }>} entries
 */
export function createActionConfig(entries) {
  return defineConfig(
    entries.map(({ input, file }) => ({
      input,
      platform: 'node',
      output: { file, format: 'esm' },
    })),
  );
}`;

function regular(file: RepositoryFile | undefined): file is RepositoryFile {
  return file?.kind === 'blob' && ['100644', '100755'].includes(file.mode);
}

function boundedText(
  file: RepositoryFile | undefined,
  read: (blob: string, sizeOnly: boolean) => Buffer,
): string | undefined {
  if (!regular(file)) return undefined;
  const size = Number(read(file.blob, true).toString('utf8').trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > METADATA_LIMIT) return undefined;
  const content = read(file.blob, false);
  if (content.length !== size || content.includes(0)) return undefined;
  return content.toString('utf8');
}

function proofFor(
  candidate: RepositoryFile,
  files: ReadonlyMap<string, RepositoryFile>,
  read: (blob: string, sizeOnly: boolean) => Buffer,
): string | undefined {
  const matched = /^(\.github\/actions\/[^/]+)\/(dist\/[\w/-]+\.mjs)$/u.exec(candidate.path);
  if (matched === null || !regular(candidate)) return undefined;
  const directory = matched[1];
  const output = matched[2];
  if (directory === undefined || output === undefined) return undefined;
  const paths = [
    `${directory}/action.yml`,
    `${directory}/package.json`,
    `${directory}/rolldown.config.mjs`,
    '.github/actions/rolldown.config.mjs',
  ];
  const metadata = paths.map((filename) => files.get(filename));
  const texts = metadata.map((file) => boundedText(file, read));
  const [actionText, packageText, configText, helperText] = texts;
  if (texts.includes(undefined)) return undefined;
  if (actionText === undefined || packageText === undefined) return undefined;
  if (configText === undefined || helperText === undefined) return undefined;
  return recipeProof({
    actionText,
    packageText,
    configText,
    helperText,
    output,
    directory,
    files,
    metadata,
  });
}

function recipeProof(input: {
  readonly actionText: string;
  readonly packageText: string;
  readonly configText: string;
  readonly helperText: string;
  readonly output: string;
  readonly directory: string;
  readonly files: ReadonlyMap<string, RepositoryFile>;
  readonly metadata: readonly (RepositoryFile | undefined)[];
}): string | undefined {
  const action = generatedActionMetadata(input.actionText, input.packageText);
  const entries = generatedActionEntries(input.configText);
  if (action === undefined || entries === undefined) return undefined;
  if (!/^node(?:20|24)$/u.test(action.using)) return undefined;
  if (!entries.some((entry) => entry.output === action.main)) return undefined;
  if (!entries.some((entry) => entry.output === input.output)) return undefined;
  if (
    generatedRecipeTokens(input.helperText).join(' ') !==
    generatedRecipeTokens(helperRecipe).join(' ')
  ) {
    return undefined;
  }
  const sources = entries.map((entry) =>
    input.files.get(path.posix.join(input.directory, entry.input)),
  );
  if (!sources.every((source) => regular(source) && source.language === 'javascript')) {
    return undefined;
  }
  const anchors = [...input.metadata, ...sources].map(
    (file) => `${file?.path ?? ''}@${file?.blob ?? ''}`,
  );
  return `Generated CI action bundle: pinned node action entry and supported static Rolldown recipe map original source to this output. Excluded from application parsing; complete tree entry retained under ancillary byte limits. Source/recipe evidence: ${anchors.join(', ')}. This declaration does not prove build reproducibility or runtime equivalence.`;
}

/** Only a supported pinned static build recipe can reclassify a generated action output. */
export function generatedActionBundles(input: {
  readonly files: readonly RepositoryFile[];
  readonly read: (blob: string, sizeOnly: boolean) => Buffer;
}): readonly RepositoryFile[] {
  const files = new Map(input.files.map((file) => [file.path, file]));
  return input.files.map((file) => {
    let reason: string | undefined;
    try {
      reason =
        proofFor(file, files, input.read) ??
        generatedNccActionProof({ candidate: file, files, read: input.read });
    } catch {
      // Malformed or unavailable metadata leaves the original parsing selection intact.
      return file;
    }
    return reason === undefined
      ? file
      : { ...file, category: 'ancillary', language: null, selectedForParsing: false, reason };
  });
}
