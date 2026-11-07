'use client';

import { useState } from 'react';

import type { ModelSystemView } from '@/application/model-system';
import { permalinkOf } from '@/domain/code-links';
import { isAuthoredReference } from '@/domain/ids';
import type { ModelCite } from '@/domain/workspace-model';
import { Callout } from '@/ui/callout';
import { Chip, ChipList } from '@/ui/chip';
import { List, ListItem } from '@/ui/list';
import { Markdown } from '@/ui/markdown';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

type Narratives = NonNullable<ModelSystemView['narratives']>;
type Story = Narratives['stories'][number];
function Sources({ cites }: { readonly cites: readonly ModelCite[] }) {
  return (
    <Stack gap={1}>
      {cites.map((cite) =>
        cite.kind === 'evidence' ? (
          <Chip id={cite.id} label={cite.id} key={cite.id} />
        ) : (
          <a key={permalinkOf(cite)} href={permalinkOf(cite)}>
            {cite.repo}/{cite.path} @ {cite.commit}
          </a>
        ),
      )}
    </Stack>
  );
}
function References({
  ids,
  labels,
}: {
  readonly ids: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
}) {
  return ids.length === 0 ? null : (
    <ChipList>
      {ids.map((id) => (
        <Chip id={id} label={labels[id] ?? id} key={id} />
      ))}
    </ChipList>
  );
}
function StoryDisclosure({
  story,
  labels,
}: {
  readonly story: Story;
  readonly labels: Readonly<Record<string, string>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary>{story.name}</summary>
      {open ? (
        <Stack gap={3}>
          <Text>Confidence: {story.confidence}</Text>
          <Markdown text={story.summary} isReference={isAuthoredReference} />
          <Markdown text={story.reasoning} isReference={isAuthoredReference} />
          <List>
            {story.stages.map((stage, at) => (
              <ListItem key={`${story.id}:${stage.component}:${String(at)}`}>
                <Stack gap={2}>
                  <Text weight="strong">{stage.title}</Text>
                  <References ids={[stage.component, ...stage.supporting]} labels={labels} />
                  <Markdown text={stage.summary} isReference={isAuthoredReference} />
                  <References ids={stage.backs ?? []} labels={labels} />
                  <Sources cites={stage.cites} />
                </Stack>
              </ListItem>
            ))}
          </List>
          {story.limitations.length === 0 ? null : (
            <Callout title="Limitations">
              {story.limitations.map((line, at) => (
                <p key={`${story.id}:limit:${String(at)}`}>{line}</p>
              ))}
            </Callout>
          )}
          <References ids={story.relatedSystems ?? []} labels={labels} />
          {(story.connections ?? []).map((connection, at) => (
            <Stack key={`${story.id}:connection:${String(at)}`}>
              <Text>
                {connection.label} ({connection.kind})
              </Text>
              <References
                ids={[connection.from, connection.to, ...(connection.backs ?? [])]}
                labels={labels}
              />
              <Sources cites={connection.cites} />
            </Stack>
          ))}
        </Stack>
      ) : null}
    </details>
  );
}
/** Complete recorded stories, expanded on request without sending their rendered detail twice. */
export function ModelSystemNarratives({
  narratives,
  labels,
}: {
  readonly narratives: ModelSystemView['narratives'];
  readonly labels: Readonly<Record<string, string>>;
}) {
  if (narratives === null) return null;
  return (
    <Stack gap={3}>
      <Text as="h3" size="lg" weight="strong">
        Inferred stories
      </Text>
      <Text tone="muted">
        Interpretations of the cited evidence; these stories do not establish execution.
      </Text>
      {narratives.stories.map((story) => (
        <StoryDisclosure key={story.id} story={story} labels={labels} />
      ))}
      <details>
        <summary>How these interpretations were produced</summary>
        <p>
          Authored {narratives.authored}; generator {narratives.generator}; input fingerprint{' '}
          {narratives.basis}.
        </p>
      </details>
    </Stack>
  );
}
