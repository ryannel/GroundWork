import type { Model } from '@/application/plan/derive';
import {
  type Show,
  inCut,
  poolOf,
  searchText,
  teamsWhere,
  viewOf,
  groupBy,
} from '@/application/plan-story-ref';
import { sortEvents } from '@/application/plan-viz-events';
import type { MessageNode } from '@/domain/plan/plan-graph';
import { EventLine } from '@/features/plan/viz/event-line/event-line';

import { type CatProps, Group, Pages, RefChip, rowAttrs } from './catalogue-bits';

function topicGroups(model: Model, show: Show) {
  const all = poolOf(model.asIs.messages, model.toBe.messages, show);
  const order = sortEvents(
    model,
    all.map((m) => m.id),
  );
  const sorted = order.flatMap((id) => all.filter((m) => m.id === id));
  return [...groupBy(sorted, (m) => m.topic)];
}

function EventRow({
  model,
  show,
  m,
}: {
  readonly model: Model;
  readonly show: Show;
  readonly m: MessageNode;
}) {
  const consumers = m.consumers ?? [];
  const teams = teamsWhere(
    model,
    (cut) => inCut(model, cut, m.id) || consumers.some((c) => cut.has(c)),
  );
  return (
    <div
      {...rowAttrs(
        searchText(m.name, m.id, m.version, m.producer, consumers, m.summary, m.key),
        teams,
      )}
    >
      <EventLine groupTopic id={m.id} mode={viewOf(show)} model={model} />
    </div>
  );
}

/** Messages on topics, grouped by the topic. */
export function EventsCat({ model, teams }: CatProps) {
  return (
    <Pages
      model={model}
      modes
      empty="No events."
      noun="events"
      render={(show) =>
        topicGroups(model, show).map(([topic, messages]) => (
          <Group
            count={messages.length}
            key={topic}
            title={<RefChip id={topic} model={model} quiet={show !== 'diff'} />}
          >
            {messages.map((m) => (
              <EventRow key={m.id} m={m} model={model} show={show} />
            ))}
          </Group>
        ))
      }
      teams={teams}
    />
  );
}
