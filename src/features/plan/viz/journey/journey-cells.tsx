import type { Model } from '@/application/plan/derive';
import type { Cells } from '@/application/plan-viz-journey-compare';
import type { SideContent } from '@/application/plan-viz-journey-sides';
import { type JourneyMode, MODE_NAMES, propLabel } from '@/application/plan-viz-journey-words';
import { ModelText } from '@/features/plan/common/model-text';

import styles from './journey-cells.module.css';
import { JourneyValue } from './journey-value';

interface SideProps {
  readonly model: Model;
  readonly mode: JourneyMode;
  readonly content: SideContent;
}

function Content({ model, content }: { readonly model: Model; readonly content: SideContent }) {
  if (content.kind === 'text') return <p>{content.text}</p>;
  if (content.kind === 'prose') return <ModelText model={model} text={content.text} />;
  return <JourneyValue model={model} value={content.value} />;
}

/** What one view says, under that view's name. */
export function JourneySide({ model, mode, content }: SideProps) {
  return (
    <div className={styles.side}>
      <strong>{MODE_NAMES[mode]}</strong>
      <Content content={content} model={model} />
    </div>
  );
}

interface CellsProps {
  readonly model: Model;
  readonly cells: Cells;
}

/** Today beside the plan; or, when one side is already shown above, only the other. */
export function JourneyCells({ model, cells }: CellsProps) {
  if (cells.kind === 'pair') {
    return (
      <div className={styles.pair}>
        <JourneySide content={cells.before} mode="asIs" model={model} />
        <JourneySide content={cells.after} mode="toBe" model={model} />
      </div>
    );
  }
  const other: JourneyMode = cells.shown === 'asIs' ? 'toBe' : 'asIs';
  return (
    <div className={styles.counterpart}>
      <p className={styles.shown}>
        <strong>{MODE_NAMES[cells.shown]}</strong> · {propLabel(cells.property).toLowerCase()} shown
        above
      </p>
      <JourneySide content={cells.other} mode={other} model={model} />
    </div>
  );
}
