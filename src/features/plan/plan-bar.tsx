import Link from 'next/link';

import type { BarVersions, PlanBar } from '@/application/plan-bar';
import type { Outline } from '@/application/plan-pages';
import { Badge } from '@/ui/badge';
import { Menu } from '@/ui/menu.client';

import { HelpButton } from './cheat-sheet.client';
import { Palette } from './palette.client';
import styles from './plan-bar.module.css';
import { ReadAs } from './read-as.client';

const STATE_TONE = {
  proposed: 'modified',
  approved: 'added',
  superseded: 'neutral',
  rejected: 'removed',
} as const;

function VersionMenu({ versions }: { readonly versions: BarVersions }) {
  if (versions.items.length === 0 || versions.historyHref === null)
    return <span className={styles.version}>{versions.label}</span>;
  return (
    <Menu button={<span className={styles.mono}>{versions.label}</span>} label="Version history">
      <p className={styles.menuHead}>Version history</p>
      <ul className={styles.versions}>
        {versions.items.map((v) => (
          <li key={v.version}>
            <Link className={styles.item} href={v.href}>
              <span className={styles.itemTop}>
                <span className={styles.mono}>{v.version}</span>
                <Badge tone={STATE_TONE[v.state]}>{v.state}</Badge>
                <span className={styles.date}>{v.date}</span>
              </span>
              {v.summary === '' ? null : <span className={styles.summary}>{v.summary}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link className={styles.all} href={versions.historyHref}>
        Every version and what it changed →
      </Link>
    </Menu>
  );
}

interface PlanActionsProps {
  readonly bar: PlanBar;
  readonly outline: Outline;
  /** Where the browser reads the plan. */
  readonly src: string;
}

// The plan's part of the top bar: where it stands, its version, the team it is read as, search and help.
export function PlanActions({ bar, outline, src }: PlanActionsProps) {
  return (
    <>
      <span className={styles.stage} title="Where the plan stands">
        <Badge tone={bar.stage.tone}>{bar.stage.word}</Badge>
      </span>
      {bar.versions === null ? null : <VersionMenu versions={bar.versions} />}
      <ReadAs teams={bar.teams} />
      <Palette outline={outline} src={src} />
      <HelpButton />
    </>
  );
}
