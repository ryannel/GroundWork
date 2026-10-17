'use client';

import { use, useMemo, useState, useTransition } from 'react';

import { thingAt, topThingIds } from '@/application/plan-pages-things';
import type { Reader } from '@/application/today-reader';
import { pendingModel } from '@/features/plan/plan-model';

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
  const head = use(pendingModel(reader.modelSrc).model);
  const [version, setVersion] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown =
    version === null ? head : use(pendingModel(revisionSrc(reader.modelSrc, version)).model);
  const page = useMemo(
    () => (head !== null && topThingIds(head).includes(id) ? thingAt(reader.thingBase, id) : null),
    [head, reader.thingBase, id],
  );
  if (head === null) {
    const what = reader.mode === 'plan' ? 'The plan' : 'How the systems work today';
    return <p className={styles.note}>{`${what} could not be loaded.`}</p>;
  }
  const jump = (next: string | null): void => {
    startTransition(() => {
      setVersion(next);
    });
  };
  return (
    <>
      <InspectorBar id={id} model={head} page={page} />
      {reader.mode === 'plan' ? <VersionJump model={head} onChange={jump} value={version} /> : null}
      {shown === null ? (
        <p className={styles.note}>{`No copy of version ${version ?? ''} was kept.`}</p>
      ) : (
        <ThingView id={id} key={version ?? ''} model={shown} reader={reader} version={version} />
      )}
    </>
  );
}
