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
import { EventSteps } from '@/features/plan/viz/event-line/event-steps.client';

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

function EventGroups({ model, show }: { readonly model: Model; readonly show: Show }) {
  const groups = topicGroups(model, show);
  const events = groups.flatMap(([, messages]) =>
    messages.map((m) => ({ key: m.id, title: model.label(m.id) })),
  );
  return (
    <EventSteps events={events}>
      {groups.map(([topic, messages]) => (
        <Group
          count={messages.length}
          key={topic}
          title={<RefChip id={topic} model={model} quiet={show !== 'diff'} />}
        >
          {messages.map((m) => (
            <EventRow key={m.id} m={m} model={model} show={show} />
          ))}
        </Group>
      ))}
    </EventSteps>
  );
}

/** Messages on topics, grouped by the topic; → and ← open one event at a time. */
export function EventsCat({ model, teams }: CatProps) {
  return (
    <Pages
      model={model}
      modes
      empty="No events."
      noun="events"
      render={(show) =>
        topicGroups(model, show).length === 0
          ? []
          : [<EventGroups key="events" model={model} show={show} />]
      }
      teams={teams}
    />
  );
}
