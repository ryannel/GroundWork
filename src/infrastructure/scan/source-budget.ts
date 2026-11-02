import 'server-only';

export const DEFAULT_MAX_SOURCE_BYTES = 1_048_576;
const MAX_SOURCE_BYTES = 33_554_432;

export interface SourceSize {
  readonly path: string;
  readonly blob: string;
  readonly bytes: number;
}

export class SourceBudgetError extends Error {
  readonly code = 'SOURCE_BUDGET_EXCEEDED';
  readonly path: string;
  readonly blob: string;
  readonly bytes: number;
  readonly limit: number;

  constructor(source: SourceSize, limit: number) {
    super(
      `Selected source ${source.path} (${source.blob}) is ${String(source.bytes)} bytes; the source limit is ${String(limit)} bytes. No selected source bytes were read.`,
    );
    this.name = 'SourceBudgetError';
    this.path = source.path;
    this.blob = source.blob;
    this.bytes = source.bytes;
    this.limit = limit;
  }
}

/** The upper limit matches the pinned Git reader's existing output bound. */
export function sourceByteLimit(value = DEFAULT_MAX_SOURCE_BYTES): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_SOURCE_BYTES) {
    throw new Error(
      `Source byte limit must be a positive integer at most ${String(MAX_SOURCE_BYTES)}.`,
    );
  }
  return value;
}

/** Metadata is checked before retained source/index caches or Git blob bytes are read. */
export function assertSourceBudget(source: SourceSize, limit = DEFAULT_MAX_SOURCE_BYTES): void {
  const maximum = sourceByteLimit(limit);
  if (!Number.isSafeInteger(source.bytes) || source.bytes < 0) {
    throw new Error(`Invalid pinned source size for ${source.path}.`);
  }
  if (source.bytes > maximum) throw new SourceBudgetError(source, maximum);
}
