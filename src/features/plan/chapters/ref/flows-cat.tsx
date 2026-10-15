import { fadesIn, poolOf, searchText, teamsWhere } from '@/application/plan-story-ref';
import { flowTeams } from '@/application/plan-story-ref-rows';
import { countOf } from '@/application/plan-viz-text';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamDot } from '@/features/plan/common/team-dot';

import { Cell, Dots, type CatProps, Pages, RefChip, RefTable, rowAttrs } from './catalogue-bits';
import { StatusCell } from './status-cell';

const HEAD = ['flow', 'actor', 'steps', 'teams', 'outcome'];

/** Every flow in one table. */
export function FlowsCat({ model, teams }: CatProps) {
  return (
    <Pages
      model={model}
      modes
      empty="No flows."
      noun="flows"
      render={(show) => {
        const flows = poolOf(model.asIs.flows, model.toBe.flows, show);
        return flows.length === 0
          ? []
          : [
              <RefTable key="flows" head={show === 'diff' ? [...HEAD, 'status'] : HEAD}>
                {flows.map((f) => (
                  <tr
                    key={f.id}
                    {...rowAttrs(
                      searchText(
                        f.name,
                        f.id,
                        f.actor,
                        f.trigger,
                        f.outcome,
                        f.steps.map((s) => s.action),
                      ),
                      teamsWhere(model, (cut) => cut.flows.includes(f.id)),
                      fadesIn(model, show, f.id),
                    )}
                  >
                    <Cell label="flow">
                      <RefChip id={f.id} model={model} quiet={show !== 'diff'} />
                    </Cell>
                    <Cell label="actor">{f.actor ?? '—'}</Cell>
                    <Cell label="steps">{countOf(f.steps.length, 'step')}</Cell>
                    <Cell label="teams">
                      <Dots>
                        {flowTeams(model, f).map((t) => (
                          <TeamDot key={t} model={model} teamId={t} />
                        ))}
                      </Dots>
                    </Cell>
                    <Cell label="outcome" wide>
                      <ModelInline model={model} text={f.outcome ?? f.trigger ?? ''} />
                    </Cell>
                    {show === 'diff' ? (
                      <Cell label="status">
                        <StatusCell id={f.id} model={model} show={show} />
                      </Cell>
                    ) : null}
                  </tr>
                ))}
              </RefTable>,
            ];
      }}
      teams={teams}
    />
  );
}
