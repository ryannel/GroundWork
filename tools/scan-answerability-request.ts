import type { Probe } from './scan-answerability-probe';

function stringList(input: unknown): input is readonly string[] {
  return Array.isArray(input) && input.every((item: unknown) => typeof item === 'string');
}

function isCheck(input: unknown): input is Probe['checks'][number] {
  if (typeof input !== 'object' || input === null) return false;
  if (!('kind' in input) || typeof input.kind !== 'string') return false;
  if (
    ![
      'guard-return',
      'guard-exit-before-call',
      'ordered-calls',
      'branch-call',
      'call-arguments',
    ].includes(input.kind)
  ) {
    return false;
  }
  if (!('expected' in input) || typeof input.expected !== 'string') return false;
  if (!('call' in input) || typeof input.call !== 'string') return false;
  return 'arguments' in input && stringList(input.arguments);
}

function isProbe(input: unknown): input is Probe {
  if (typeof input !== 'object' || input === null) return false;
  if (!('id' in input) || typeof input.id !== 'string' || !/^[\w-]+$/u.test(input.id)) return false;
  if (!('sourcePath' in input) || typeof input.sourcePath !== 'string') return false;
  if (!('functionName' in input) || typeof input.functionName !== 'string') return false;
  return 'checks' in input && Array.isArray(input.checks) && input.checks.every(isCheck);
}

export function answerabilityRequest(input: unknown): readonly Probe[] {
  if (typeof input !== 'object' || input === null || !('probes' in input)) {
    throw new Error('Question request must contain probes');
  }
  const probes = input.probes;
  if (!Array.isArray(probes) || !probes.every(isProbe)) throw new Error('Invalid question probe');
  return probes;
}
