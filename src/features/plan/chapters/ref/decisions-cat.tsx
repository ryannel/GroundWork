import type { Model } from '@/application/plan/derive';
import {
  decidingSearch,
  registerGroups,
  type RegisterGroupView,
} from '@/application/plan-story-ref-register';
import { deciding, titleOf, numberOf } from '@/application/plan-viz-decision';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { DecisionCard } from '@/features/plan/viz/decisions/decision-card';

import { type CatProps, Cards, Fold, Group, Pages, rowAttrs } from './catalogue-bits';

const CARDS = new Set(['decide', 'decided']);

function Cardful({ model, g }: { readonly model: Model; readonly g: RegisterGroupView }) {
  return (
    <Group count={g.ids.length} note={g.note} title={g.label}>
      <Cards>
        {g.ids.map((id) => {
          const e = deciding(model, id);
          return e === undefined ? null : (
            <div key={id} {...rowAttrs(decidingSearch(model, e), '')}>
              <DecisionCard e={e} model={model} />
            </div>
          );
        })}
      </Cards>
    </Group>
  );
}

function Folded({ model, g }: { readonly model: Model; readonly g: RegisterGroupView }) {
  return (
    <Fold summary={`${g.label} · ${String(g.ids.length)} — ${g.note}`}>
      {g.ids.map((id) => {
        const e = deciding(model, id);
        return e === undefined ? null : (
          <li key={id} {...rowAttrs(decidingSearch(model, e), '')}>
            <EntityChip
              id={id}
              label={`${numberOf(model, id)} ${titleOf(e)}`}
              model={model}
              status="existing"
            />
            {e.decider === undefined ? null : <TeamTag model={model} teamId={e.decider} />}
          </li>
        );
      })}
    </Fold>
  );
}

/** Every decision and question, grouped by where it stands; the groups that block nothing fold. */
export function DecisionsCat({ model, teams }: CatProps) {
  return (
    <Pages
      empty="This plan records no decisions or questions."
      model={model}
      modes={false}
      noun="decisions"
      render={() =>
        registerGroups(model).map((g) =>
          CARDS.has(g.key) ? (
            <Cardful g={g} key={g.key} model={model} />
          ) : (
            <Folded g={g} key={g.key} model={model} />
          ),
        )
      }
      teams={teams}
    />
  );
}
