import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { ExperienceData } from '@/application/plan-viz-experience';
import type { ScreenMode } from '@/application/plan-viz-screens';
import { ModelText } from '@/features/plan/common/model-text';
import { ScreenFigure } from '@/features/plan/viz/screens/screen-figure';

import { ExperienceSystems } from './experience-systems';
import { ExperienceTabs } from './experience-tabs';
import styles from './experience.module.css';

export interface ExperienceProps {
  readonly model: Model;
  readonly data: ExperienceData;
  readonly mode: ScreenMode;
  /** Where the plan's images are served from. */
  readonly base: string;
  /** Leave out the "today / planned" line, as a journey says it already. */
  readonly bare?: boolean | undefined;
  /** Marks under each moment's title, in the order of the moments. */
  readonly tabMarks?: readonly ReactNode[] | undefined;
  /** Marks beside each system step, by step id. */
  readonly systemMarks?: ReadonlyMap<string, ReactNode> | undefined;
  /** What the plan changes in this moment; shown under the heading. */
  readonly comparison?: ReactNode;
  /** Back and forward through the system steps. */
  readonly stepper?: ReactNode;
}

function Screen({
  model,
  data,
  mode,
  base,
}: Pick<ExperienceProps, 'model' | 'data' | 'mode' | 'base'>) {
  const { screen } = data;
  if (screen.kind === 'none') {
    return <p className={styles.note}>No screen is linked to these steps.</p>;
  }
  if (screen.kind === 'missing') {
    return <p className={styles.note}>Screen details are unavailable in this view.</p>;
  }
  return (
    <>
      {data.linked ? (
        <p className={styles.note}>
          Screen reference: this step names the screen, it does not act on it.
        </p>
      ) : null}
      <ScreenFigure
        base={base}
        caption={false}
        focus={screen.focus}
        id={screen.id}
        mode={mode}
        model={model}
      />
    </>
  );
}

function Onward({ data }: { readonly data: ExperienceData }) {
  return (
    <>
      {data.trace === null ? null : (
        <button className={styles.trace} data-step={data.trace} type="button">
          Trace the system work →
        </button>
      )}
      {data.next === null ? (
        <p className={styles.note}>Last recorded screen.</p>
      ) : (
        <button className={styles.next} data-step={data.next.stop} type="button">
          <span>Next in the recorded flow</span>
          <strong>{data.next.title}</strong>
        </button>
      )}
    </>
  );
}

// A flow as the person sees it: the moments in order, the screen they are on, and the system work behind each.
export function Experience({
  model,
  data,
  bare = false,
  tabMarks,
  comparison,
  base,
  mode,
  systemMarks,
  stepper,
}: ExperienceProps) {
  return (
    <section className={styles.experience}>
      {bare ? null : <p className={styles.topline}>{data.topline}</p>}
      <ExperienceTabs marks={tabMarks} tabs={data.tabs} />
      <header className={styles.heading}>
        <span>
          {data.word}
          {data.screenName === null ? '' : ` · ${data.screenName}`}
        </span>
        <h3>{data.title}</h3>
        {data.shows === '' ? null : <ModelText model={model} text={data.shows} />}
      </header>
      {comparison}
      <div className={styles.body}>
        <div className={styles.screen}>
          <Screen base={base} data={data} mode={mode} model={model} />
          <Onward data={data} />
        </div>
        <div>
          <ExperienceSystems
            marks={systemMarks}
            model={model}
            place={data.key}
            systems={data.systems}
          />
          {stepper}
        </div>
      </div>
    </section>
  );
}
