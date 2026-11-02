export interface ValidationOptions {
  readonly files: readonly string[];
  readonly snapshot?: string | undefined;
  readonly writeSnapshot?: string | undefined;
  readonly sources?: string | undefined;
}

const SNAPSHOT = '--snapshot';
const WRITE_SNAPSHOT = '--write-snapshot';
const SOURCES = '--sources';

export function validationOptions(args: readonly string[]): ValidationOptions {
  const files: string[] = [];
  const flags = new Map<string, string>();
  const allowed = new Set([SNAPSHOT, WRITE_SNAPSHOT, SOURCES]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    if (!argument.startsWith('--')) {
      files.push(argument);
      continue;
    }
    const value = args[index + 1];
    if (!allowed.has(argument) || flags.has(argument)) {
      throw new Error(`Unknown or repeated option: ${argument}`);
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    flags.set(argument, value);
    index += 1;
  }
  if (files.length === 0) throw new Error('Pass at least one canonical bundle JSON file');
  if (flags.has(SNAPSHOT) && flags.has(WRITE_SNAPSHOT)) {
    throw new Error('Choose --snapshot or --write-snapshot');
  }
  return {
    files,
    snapshot: flags.get(SNAPSHOT),
    writeSnapshot: flags.get(WRITE_SNAPSHOT),
    sources: flags.get(SOURCES),
  };
}
