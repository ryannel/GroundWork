import Link from 'next/link';

import { thingAt } from '@/application/plan-pages-things';
import type { TodayPlace } from '@/application/today-thing';
import { workspaceHref } from '@/application/workspace-paths';
import type { Workspace } from '@/domain/workspace';
import { CopyLink } from '@/features/plan/inspector/copy-link.client';

import styles from './today-wayfinding.module.css';

/** Where the thing sits: its domain, its system and, for a part, its component. */
export function Place({ place, base }: { readonly place: TodayPlace; readonly base: string }) {
  return (
    <nav aria-label="Where it sits" className={styles.place}>
      <Link href={place.domain.href}>{place.domain.label}</Link>
      <span aria-hidden="true">›</span>
      <Link href={place.system.href}>{place.system.label}</Link>
      {place.component === null ? null : (
        <>
          <span aria-hidden="true">›</span>
          <Link href={thingAt(base, place.component.id)}>{place.component.name}</Link>
        </>
      )}
    </nav>
  );
}

/** The way back, where the thing comes in its register, and a link to copy. */
export function TopLine({
  place,
  workspaceId,
  count,
}: {
  readonly place: TodayPlace | null;
  readonly workspaceId: Workspace['id'];
  readonly count: string;
}) {
  const back = place?.system ?? { label: 'the landscape', href: workspaceHref(workspaceId) };
  return (
    <div className={styles.top}>
      <Link className={styles.back} href={back.href}>
        ← Back to {back.label}
      </Link>
      <span className={styles.count}>{count}</span>
      <CopyLink label="Copy a link to this page" />
    </div>
  );
}
