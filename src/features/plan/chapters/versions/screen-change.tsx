import type { Model } from '@/application/plan/derive';
import type { Mark } from '@/application/plan-story-versions-marks';
import type { RegionBody, RegionView, ScreenView } from '@/application/plan-story-versions-screens';
import { assetUrl } from '@/application/plan-viz-screens';
import { ModelInline } from '@/features/plan/common/model-text';
import { PlanImage } from '@/features/plan/viz/screens/plan-image';

import { DiffPair } from './diff-pair';
import styles from './screen-change.module.css';
import { WorkRows } from './work-rows';

/** The tag a step, screen or region wears for what the revision does to it. */
export function MarkTag({ mark }: { readonly mark: Mark }) {
  return (
    <span className={styles.mark} data-mark={mark.cls}>
      {mark.text}
    </span>
  );
}

function Body({ model, body }: { readonly model: Model; readonly body: RegionBody }) {
  switch (body.kind) {
    case 'carry': {
      return <ModelInline model={model} text={body.text} />;
    }
    case 'text': {
      return body.struck ? <del>{body.text}</del> : <span>{body.text}</span>;
    }
    case 'diff': {
      return <DiffPair diff={body.diff} />;
    }
    case 'moves': {
      return <span className={styles.quiet}>Moves on the screen.</span>;
    }
  }
}

function Region({ model, region }: { readonly model: Model; readonly region: RegionView }) {
  return (
    <li className={styles.region}>
      <div className={styles.name}>
        <b>{region.name}</b>
        <MarkTag mark={region.mark} />
      </div>
      <Body body={region.body} model={model} />
    </li>
  );
}

/** A screen's pictures before and after the revision, then the regions it changes. */
export function ScreenChange({
  model,
  base,
  screen,
}: {
  readonly model: Model;
  readonly base: string;
  readonly screen: ScreenView;
}) {
  return (
    <div className={styles.screen}>
      <div className={styles.name}>
        <b>{screen.name}</b>
        <MarkTag mark={screen.mark} />
      </div>
      {screen.pictures.length === 0 ? null : (
        <div className={styles.pictures}>
          {screen.pictures.map((p) => (
            <figure className={styles.picture} key={p.version}>
              {p.image === null ? (
                <div className={styles.blank}>No picture</div>
              ) : (
                <PlanImage alt={p.alt} className={styles.image} src={assetUrl(base, p.image)} />
              )}
              <figcaption>{p.version}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {screen.regions.length === 0 ? null : (
        <ul className={styles.regions}>
          {screen.regions.map((r) => (
            <Region key={r.id} model={model} region={r} />
          ))}
        </ul>
      )}
      {screen.builtBy.length === 0 ? null : (
        <div className={styles.built}>
          <span className={styles.label}>Built by</span>
          <WorkRows model={model} rows={screen.builtBy} />
        </div>
      )}
    </div>
  );
}
