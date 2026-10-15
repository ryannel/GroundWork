import type { Model } from '@/application/plan/derive';
import { screenCatalogue } from '@/application/plan-viz-screen-catalogue';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import { ScreenCards } from './screen-cards';
import styles from './screen-catalogue.module.css';
import { ScreenMapFigure } from './screen-map-figure';
import { ScreenMapFrame } from './screen-map-frame.client';

export interface ScreenCatalogueProps {
  readonly model: Model;
  /** Where the plan's pictures are served from. */
  readonly base: string;
}

// The screens people use today: each drawn once, joined by the sequences the plan records, grouped by who does
// them; and under it a card for every screen and document.
export function ScreenCatalogue({ model, base }: ScreenCatalogueProps) {
  const view = screenCatalogue(model);
  if (view === null) return null;
  return (
    <div className={styles.catalogue}>
      <ScreenMapFrame hasShared={view.hasShared} journeys={view.journeys}>
        <p className={styles.key}>{view.key}</p>
        {view.groups.map((group, g) => (
          <section className={styles.group} key={group.label}>
            <h3 className={styles.actor}>{group.label}</h3>
            {group.clusters.map((cluster, c) => (
              <div className={styles.cluster} key={cluster.screens[0]?.id ?? String(c)}>
                {cluster.caption === '' ? null : (
                  <p className={styles.caption}>{cluster.caption}</p>
                )}
                {cluster.note === '' ? null : <p className={styles.note}>{cluster.note}</p>}
                <ScrollCue>
                  <ScreenMapFigure
                    cluster={cluster}
                    marker={`screen-arrow-${String(g)}-${String(c)}`}
                  />
                </ScrollCue>
              </div>
            ))}
          </section>
        ))}
      </ScreenMapFrame>
      <ScreenCards base={base} model={model} sections={view.sections} />
    </div>
  );
}
