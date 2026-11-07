'use client';

import { use, useMemo, useState, useTransition } from 'react';

import { topThingIds } from '@/application/plan-pages-things';
import { thingAt } from '@/application/thing-paths';
import type { Reader } from '@/application/today-reader';
import { pendingLegacyModel } from '@/features/plan/legacy-plan-model';

import { InspectorBar } from './inspector-bar.client';
import { ThingView } from './thing-view.client';
import styles from './thing.module.css';
import { revisionSrc, VersionJump } from './version-jump.client';

interface ThingProps {
  readonly id: string;
  /** Where the model is and where its pages and pictures are; a plan's reader also names the plan. */
  readonly reader: Reader;
}

// What the inspector shows for one id: the bar, the version it is read at, then the thing. A new id remounts it,
// so the switch starts on the plan, at the version being read, each time. Today has no versions.
export function Thing({ id, reader }: ThingProps) {
  const head = use(pendingLegacyModel(reader.modelSrc).model);
  const [version, setVersion] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown =
    version === null ? head : use(pendingLegacyModel(revisionSrc(reader.modelSrc, version)).model);
  const page = useMemo(() => {
    const own = reader.pages?.[id];
    if (own !== undefined) return own;
    return head !== null && topThingIds(head).includes(id) ? thingAt(reader.thingBase, id) : null;
  }, [head, reader, id]);
  if (head === null) {
    const what = reader.mode === 'plan' ? 'The plan' : 'How the systems work today';
    return (
      <>
        <InspectorBar id={id} model={null} />
        <p className={styles.note}>{`${what} could not be loaded.`}</p>
      </>
    );
  }
  const jump = (next: string | null): void => {
    startTransition(() => {
      setVersion(next);
    });
  };
  return (
    <>
      <InspectorBar id={id} model={head} page={page} />
      {reader.mode === 'plan' ? (
        <VersionJump plan={head.plan} onChange={jump} value={version} />
      ) : null}
      {shown === null ? (
        <p className={styles.note}>{`No copy of version ${version ?? ''} was kept.`}</p>
      ) : (
        <ThingView id={id} key={version ?? ''} model={shown} reader={reader} version={version} />
      )}
    </>
  );
}
