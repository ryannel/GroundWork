import type { Model } from '@/application/plan/derive';
import type { Moment } from '@/application/plan/flow-experience';
import { linkedScreen } from '@/application/plan-viz-experience';
import type { JourneyMode } from '@/application/plan-viz-journey-words';
import { ModelText } from '@/features/plan/common/model-text';
import { ScreenFigure } from '@/features/plan/viz/screens/screen-figure';

import styles from './journey-screen.module.css';

interface JourneyScreenProps {
  readonly model: Model;
  readonly moment: Moment | null;
  readonly mode: JourneyMode;
  /** Where the plan's pictures are served from. */
  readonly base: string;
}

/** What the region shows, as the view records it. */
function showsOf(model: Model, mode: JourneyMode, region: string | null): string {
  const node = region === null ? undefined : model[mode].get(region);
  return node?.$type === 'region' ? (node.shows ?? '') : '';
}

/** The screen the person is on at this step, folded under the step, with the region it touches lit. */
export function JourneyScreen({ model, moment, mode, base }: JourneyScreenProps) {
  const screen = moment === null ? null : linkedScreen(model, moment, mode);
  if (moment === null || screen === null) return null;
  const region = moment.region === null ? '' : ` · ${model.label(moment.region)}`;
  const shows = showsOf(model, mode, moment.region);
  return (
    <details className={styles.screen} data-keep="screen">
      <summary>
        Screen: {screen.label}
        {region}
      </summary>
      {shows === '' ? null : <ModelText model={model} text={shows} />}
      {screen.present ? (
        <ScreenFigure
          base={base}
          caption={false}
          focus={screen.focus}
          id={screen.id}
          mode={mode}
          model={model}
        />
      ) : (
        <p>The screen is not recorded in this view.</p>
      )}
    </details>
  );
}
