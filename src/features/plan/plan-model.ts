import { modelContextOf, type ModelPayload } from '@/application/model-reader';
import type { Page } from '@/application/plan-navigation';
import { THINGS_SCREEN } from '@/application/thing-paths';
import { modelRecord } from '@/domain/workspace-model';

import { modelRequestOf } from './model-request';

// This recognises the transport envelope; canonical schemas are checked at the server's load boundary.
function isNativeModel(value: unknown): boolean {
  const model = modelRecord(value);
  if (model === null) return false;
  if (model.format !== undefined && model.format !== 2) return false;
  return (
    typeof model.id === 'string' &&
    [
      'domains',
      'evidence',
      'libraries',
      'externals',
      'graphs',
      'flows',
      'journeys',
      'programmes',
      'problems',
    ].every((key) => Array.isArray(model[key]))
  );
}
function isNativePayload(value: unknown): value is ModelPayload {
  const data = modelRecord(value);
  if (data === null) return false;
  if (isNativeModel(data.model)) return true;
  return modelRecord(data.plan) !== null && isNativeModel(data.before) && isNativeModel(data.after);
}

// plan.json sits beside the cover, one level up from the things page and two from a screen; a relative address
// works under any base path.
export function planJsonOf(page: Page): string {
  if (page.chapter === 'cover' && page.screen === 'cover') return 'plan.json';
  return page.chapter === 'ref' && page.screen === THINGS_SCREEN
    ? '../plan.json'
    : '../../plan.json';
}

/** The browser builds query indices over supplied facts; it never replays operations. */
export const pendingNativeModel = modelRequestOf((value) =>
  isNativePayload(value) ? modelContextOf(value) : null,
);
