import { Renderer } from '../theme/render';

/** Raised by a command to abort with an error card and exit code 1, mirroring the
 *  bash `fail()` helper. */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly action?: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

/** Raised for usage errors (bad/missing args, unknown flags) → exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export interface Ctx {
  /** Human-facing renderer (writes to stderr). */
  r: Renderer;
  /** Global --json mode: machine output to stdout, no spinners/chrome. */
  json: boolean;
  /** Positional args after the command verb. */
  args: string[];
  /** Project prefix (for container names etc.), from dev.config.json. */
  projectPrefix: string;
}

export function elapsedSince(startMs: number): string {
  return `${Math.round((Date.now() - startMs) / 1000)}s`;
}
