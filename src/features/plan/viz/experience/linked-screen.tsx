import type { Model } from '@/application/plan/derive';
import type { LinkedScreen } from '@/application/plan-viz-experience';
import type { ScreenMode } from '@/application/plan-viz-screens';
import { ScreenFigure } from '@/features/plan/viz/screens/screen-figure';

import styles from './linked-screen.module.css';

interface LinkedScreenProps {
  readonly model: Model;
  readonly screen: LinkedScreen | null;
  readonly mode: ScreenMode;
  readonly base: string;
}

// The screen a step is tied to, shown beside the diagram with the region it touches lit.
export function LinkedScreenBlock({ model, screen, mode, base }: LinkedScreenProps) {
  if (screen === null) return null;
  return (
    <section aria-label="Linked screen" className={styles.block}>
      <p className={styles.line}>
        Linked screen: <strong>{screen.label}</strong>
      </p>
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
        <p className={styles.line}>Screen details are unavailable.</p>
      )}
    </section>
  );
}
