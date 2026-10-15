import type { Model } from '@/application/plan/derive';
import type { Route } from '@/application/plan-viz-flow-narration';
import { EntityChip } from '@/features/plan/common/entity-chip';

import styles from './step-route.module.css';

interface RouteProps {
  readonly model: Model;
  readonly route: Route;
  readonly vias: readonly string[];
}

function Chips({ model, ids }: { readonly model: Model; readonly ids: readonly string[] }) {
  return (
    <span className={styles.chips}>
      {ids.map((id) => (
        <EntityChip id={id} key={id} model={model} />
      ))}
    </span>
  );
}

function Who({ model, route }: Pick<RouteProps, 'model' | 'route'>) {
  switch (route.kind) {
    case 'fan': {
      return (
        <>
          <EntityChip id={route.from} model={model} />
          <span aria-hidden="true">→</span>
          <Chips ids={route.to} model={model} />
        </>
      );
    }
    case 'chain': {
      return (
        <>
          <span className={styles.label}>Participating systems</span>
          <Chips ids={route.ids} model={model} />
        </>
      );
    }
    case 'self': {
      return (
        <>
          <EntityChip id={route.id} model={model} />
          <span className={styles.label}>works on its own data</span>
        </>
      );
    }
    case 'pair': {
      return (
        <>
          <EntityChip id={route.from} model={model} />
          <span aria-hidden="true">→</span>
          <EntityChip id={route.to} model={model} />
        </>
      );
    }
  }
}

// Who a stop is between, and the interfaces the calls go through.
export function StepRoute({ model, route, vias }: RouteProps) {
  return (
    <div className={styles.route}>
      <Who model={model} route={route} />
      {vias.length === 0 ? (
        <span className={styles.label}>□ internal step</span>
      ) : (
        <>
          <span className={styles.label}>via</span>
          <Chips ids={vias} model={model} />
        </>
      )}
    </div>
  );
}
