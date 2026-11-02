function object(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readinessObject(value: unknown): Readonly<Record<string, unknown>> {
  if (!object(value)) throw new Error('Readiness evidence needs a JSON object.');
  return value;
}
export function readinessArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Readiness evidence needs a JSON array.');
  return value;
}
export function readinessString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Readiness evidence needs a string.');
  return value;
}
export function readinessNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Readiness evidence needs a finite number.');
  }
  return value;
}
