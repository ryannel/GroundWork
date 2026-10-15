import type { Model } from '@/application/plan/derive';
import {
  poolOf,
  type Show,
  fadesIn,
  inCut,
  searchText,
  teamsWhere,
} from '@/application/plan-story-ref';
import { storeFacts, storeGroups } from '@/application/plan-story-ref-system';
import type { StoreNode } from '@/domain/plan/plan-graph';
import { ModelInline } from '@/features/plan/common/model-text';

import {
  Card,
  Cards,
  type CatProps,
  Facts,
  Group,
  Pages,
  RefChip,
  RefChips,
} from './catalogue-bits';
import { StatusCell } from './status-cell';

const LAYER: Readonly<Record<string, string>> = {
  edge: 'edge cache',
  gateway: 'gateway cache',
  subgraph: 'cache in the subgraph',
};

function StoreCard({
  model,
  show,
  s,
}: {
  readonly model: Model;
  readonly show: Show;
  readonly s: StoreNode;
}) {
  const f = storeFacts(model, show, s.id);
  const quiet = show !== 'diff';
  const users = (s.access ?? []).map((a) => a.svc);
  const layer = s.layer === undefined ? '' : (LAYER[s.layer] ?? s.layer);
  return (
    <Card
      faded={fadesIn(model, show, s.id)}
      search={searchText(
        s.name,
        s.id,
        s.kind,
        s.layer,
        s.keyed_by,
        s.tech,
        model.label(s.owner),
        s.notes,
      )}
      teams={teamsWhere(model, (cut) => inCut(model, cut, s.id) || users.some((u) => cut.has(u)))}
    >
      <div>
        <RefChip id={s.id} model={model} quiet={quiet} />{' '}
        <StatusCell id={s.id} model={model} show={show} />
      </div>
      <small>{[s.kind, s.tech].filter((x) => x !== undefined).join(' · ')}</small>
      <Facts
        rows={[
          ['Owner', <RefChip id={s.owner} key="o" model={model} quiet={quiet} />],
          ['Layer', layer !== '' && layer],
          ['Keyed by', s.keyed_by !== undefined && s.keyed_by],
          [
            'Also used by',
            users.length > 0 && <RefChips ids={users} model={model} quiet={quiet} />,
          ],
          [
            'Records',
            f.records.length > 0 && <RefChips ids={f.records} model={model} quiet={quiet} />,
          ],
          [
            'Events',
            f.events.length > 0 && <RefChips ids={f.events} model={model} quiet={quiet} />,
          ],
        ]}
      />
      {s.notes === undefined ? null : <ModelInline model={model} text={s.notes} />}
    </Card>
  );
}

/** Databases, warehouses and caches, then the topics and queues that only carry events. */
export function StoresCat({ model, teams }: CatProps) {
  return (
    <Pages
      model={model}
      modes
      empty="No stores."
      noun="stores"
      render={(show) => {
        const groups = storeGroups(poolOf(model.asIs.stores, model.toBe.stores, show));
        return groups.map((g) => (
          <Group count={g.stores.length} key={g.title} note={g.note} title={g.title}>
            <Cards>
              {g.stores.map((s) => (
                <StoreCard key={s.id} model={model} s={s} show={show} />
              ))}
            </Cards>
          </Group>
        ));
      }}
      teams={teams}
    />
  );
}
