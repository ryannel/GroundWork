import { vi } from 'vitest';

import type { ModelOp } from '@/domain/plan-apply';
import { modelValidator } from '@/infrastructure/model-schema';

vi.mock(import('server-only'), () => ({}));

const checkOp: (value: unknown) => value is ModelOp = await modelValidator('plan', 'op');
/** Validate fixture operations through the authoritative schema before entering the recursive contract. */
export function modelOp(value: unknown): ModelOp {
  if (!checkOp(value)) throw new Error('Invalid fixture operation');
  return value;
}
