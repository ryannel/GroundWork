export interface ScanArguments {
  readonly positionals: readonly string[];
  readonly cache?: string;
  readonly java?: string;
  readonly go?: string;
}

/** Explicit scopes only: there is deliberately no workspace-wide scan switch. */
export function scanArguments(args: readonly string[]): ScanArguments {
  const positionals: string[] = [];
  const options = new Map<string, string>();
  const allowed = new Set(['--cache', '--java', '--go']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      continue;
    }
    const value = args[index + 1];
    if (
      !allowed.has(argument) ||
      options.has(argument) ||
      value === undefined ||
      value.startsWith('--')
    ) {
      throw new Error(`Unknown, repeated or incomplete option ${argument}`);
    }
    options.set(argument, value);
    index += 1;
  }
  const cache = options.get('--cache');
  const java = options.get('--java');
  const go = options.get('--go');
  return {
    positionals,
    ...(cache === undefined ? {} : { cache }),
    ...(java === undefined ? {} : { java }),
    ...(go === undefined ? {} : { go }),
  };
}
