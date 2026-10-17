import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import type { Outline } from '@/application/plan-pages';
import { coverOf, statsOf, teamsWithWork } from '@/application/plan-story-cover';
import { baseLine } from '@/application/plan-story-cover-base';
import type { AskLine, AskLink } from '@/application/plan-story-cover-standing';
import { teamName } from '@/application/plan-viz-teams';
import { ModelInline, ModelText } from '@/features/plan/common/model-text';
import { TeamDot } from '@/features/plan/common/team-dot';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { PageHeader } from '@/ui/page-header';

import styles from './cover-screen.module.css';

const hrefOf = (outline: Outline, link: AskLink): string | null =>
  outline.pages.find((p) => p.chapter === link.chapter && p.screen === link.screen)?.href ?? null;

function Ask({
  outline,
  lines,
}: {
  readonly outline: Outline;
  readonly lines: readonly AskLine[];
}) {
  if (lines.length === 0) return null;
  return (
    <section aria-label="Where it stands" className={styles.ask}>
      {lines.map((line) => {
        const href = line.link === null ? null : hrefOf(outline, line.link);
        return (
          <div className={styles.line} data-tone={line.tone} key={line.text}>
            <p className={styles.text}>{line.text}</p>
            {href === null || line.link === null ? null : (
              <Link className={styles.go} href={href}>
                {line.link.label}
              </Link>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Stats({ model }: { readonly model: Model }) {
  const stats = statsOf(model);
  if (stats.length === 0) return null;
  return (
    <dl className={styles.stats}>
      {stats.map((stat) => (
        <div className={styles.stat} key={stat.name}>
          <dt className={styles.name}>{stat.name}</dt>
          {stat.today === null ? null : (
            <dd className={styles.was}>
              <span className={styles.when}>Today</span>
              <ModelInline model={model} text={stat.today} />
            </dd>
          )}
          <dd className={styles.after}>
            <span className={styles.when}>After</span>
            <ModelInline model={model} text={stat.after} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Door({ model, outline }: { readonly model: Model; readonly outline: Outline }) {
  const teams = teamsWithWork(model);
  const part = outline.pages.find((p) => p.chapter === 'cover' && p.screen === 'part');
  if (part === undefined || teams.length === 0) return null;
  return (
    <section aria-label="Your team’s part" className={styles.door}>
      <h3 className={styles.doorHead}>Your team’s part</h3>
      <ul className={styles.teams}>
        {teams.map((team) => (
          <li key={team}>
            <Link className={styles.team} href={`${part.href}?team=${encodeURIComponent(team)}`}>
              <TeamDot model={model} named teamId={team} />
              {teamName(model, team)}
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        One page on what this plan asks of your team; the plan then keeps to the pages your team is
        in.
      </p>
    </section>
  );
}

// What ships and why, what the room is asked to do now, and a door to each team's part.
export function CoverScreen({ model, outline, base }: BodyProps) {
  const cover = coverOf(model, new Date().toISOString().slice(0, 10));
  const line = base === undefined ? null : baseLine(base, (id) => model.label(id), model.today);
  return (
    <>
      <PageHeader
        description={<ModelText model={model} text={cover.summary} />}
        title={cover.title}
      />
      <Ask lines={line === null ? cover.ask : [...cover.ask, line]} outline={outline} />
      <Stats model={model} />
      <Door model={model} outline={outline} />
    </>
  );
}
