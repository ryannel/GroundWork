import type { Model } from '@/application/plan/derive';
import { uiJourney } from '@/application/plan/ui-journey';
import {
  type ScreenMode,
  type StopRef,
  type StripLeg,
  stripLegs,
} from '@/application/plan-viz-screens';
import type { StepAction } from '@/features/plan/viz/flow-diagram/flow-hit';
import { Icon } from '@/ui/icon';

import styles from './journey-strip.module.css';
import { PlanImage } from './plan-image';

export interface JourneyStripProps {
  readonly model: Model;
  readonly flowId: string;
  /** Where the plan's pictures are served from. */
  readonly base: string;
  readonly mode?: ScreenMode;
  /** The leg holding one of these steps is the current one. */
  readonly currentStepIds?: readonly string[];
  /** The stepper's stops, so a leg can say which stop reaches it. */
  readonly stops?: readonly StopRef[] | null;
  readonly label?: string;
  /** Called with the stop (0-based) a leg's first step is in; without it a leg opens its screen. */
  readonly onGoto?: ((stop: number) => void) | undefined;
  /** `go`: a leg carries its stop's number (1-based, as `data-step`) for a viewer that handles clicks itself. */
  readonly action?: StepAction | undefined;
}

function Thumb({ image }: { readonly image: string }) {
  if (image === '') {
    return (
      <span aria-hidden="true" className={styles.blank}>
        <Icon name="screen" />
      </span>
    );
  }
  return <PlanImage alt="" className={styles.img} src={image} />;
}

/** A leg's click: go to the stop that reaches it, when the strip was given somewhere to go. */
function gotoHandler(leg: StripLeg, goto: boolean, onGoto: ((stop: number) => void) | undefined) {
  return () => {
    if (goto && onGoto !== undefined) onGoto(leg.stop);
  };
}

function Leg({
  leg,
  onGoto,
  action,
}: {
  readonly leg: StripLeg;
  readonly onGoto?: ((stop: number) => void) | undefined;
  readonly action?: StepAction | undefined;
}) {
  const handled = action === 'go' && leg.stop >= 0;
  const goto = (onGoto !== undefined || handled) && leg.stop >= 0;
  const title = goto ? `${leg.name} · go to this step` : leg.name;
  return (
    <li className={styles.leg} data-current={leg.current ? '' : undefined} data-status={leg.status}>
      <button
        aria-current={leg.current ? 'step' : undefined}
        className={styles.btn}
        data-inspect={goto ? undefined : leg.screen}
        data-step={handled ? leg.stop + 1 : undefined}
        onClick={onGoto === undefined ? undefined : gotoHandler(leg, goto, onGoto)}
        title={title}
        type="button"
      >
        <span className={styles.thumb} data-narrow={leg.narrow ? '' : undefined}>
          <Thumb image={leg.image} />
        </span>
        <span className={styles.name}>{leg.name}</span>
      </button>
    </li>
  );
}

// The screens of a flow as thumbnails, in the order its steps reach them. Reusable in any stepper: hand it the
// stops and an `onGoto`, and a leg moves the stepper to the stop that reaches it.
export function JourneyStrip({
  model,
  flowId,
  base,
  mode,
  currentStepIds,
  stops,
  label = 'Screen journey',
  onGoto,
  action,
}: JourneyStripProps) {
  const legs = stripLegs(model, uiJourney(model, flowId, mode), {
    base,
    mode,
    currentStepIds,
    stops,
  });
  if (legs.length === 0) return null;
  return (
    <nav aria-label={label} className={styles.strip}>
      <span className={styles.k}>
        <Icon name="screen" /> {label}
      </span>
      <ol className={styles.legs}>
        {legs.map((leg) => (
          <Leg action={action} key={leg.screen} leg={leg} onGoto={onGoto} />
        ))}
      </ol>
    </nav>
  );
}
