import Link from 'next/link';

import { everyone } from '@/application/plan-story-part-words';
import { teamName } from '@/application/plan-viz-teams';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { TeamDot } from '@/features/plan/common/team-dot';
import type { BodyProps } from '@/features/plan/screen-bodies';

import styles from './everyone-page.module.css';

// With no team in the address: one line per team, each opening that team's page.
export function EveryonePage({ model, outline, page }: BodyProps) {
  const { headline, lines } = everyone(model);
  return (
    <>
      <ScreenHead headline={headline} outline={outline} page={page}>
        <p>
          Pick a team for its page: what it decides, which of its steps change, and what it builds.
        </p>
      </ScreenHead>
      <ul className={styles.teams}>
        {lines.map(({ team, bits }) => (
          <li key={team}>
            <Link className={styles.row} href={`${page.href}?team=${encodeURIComponent(team)}`}>
              <TeamDot model={model} named teamId={team} />
              <span className={styles.name}>{teamName(model, team)}</span>
              <span className={styles.bits}>
                {bits.map((bit) => (
                  <span className={styles.bit} data-tone={bit.tone} key={bit.text}>
                    {bit.text}
                  </span>
                ))}
              </span>
              <span aria-hidden="true" className={styles.go}>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
