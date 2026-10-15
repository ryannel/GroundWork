import { versionKey } from '@/application/plan-pages-screens-versions';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { HistoryScreen } from './history-screen';
import { VersionScreen } from './version-screen';

// every version of the plan, and what each one does to the plan that stands.
export function VersionsChapter({ model, outline, page, versions }: BodyProps) {
  if (versions === undefined || versions === null) return null;
  if (page.screen === 'history') {
    return (
      <HistoryScreen model={model} outline={outline} page={page} revision={versions.revision} />
    );
  }
  const step = versions.revision.steps.find((s) => versionKey(s.version) === page.screen);
  if (step === undefined) return null;
  return (
    <VersionScreen model={model} outline={outline} page={page} step={step} versions={versions} />
  );
}
