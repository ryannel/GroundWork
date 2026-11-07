import Link from 'next/link';

import type { ModelFlowSources, ModelFlowStep, ModelFlowView } from '@/application/model-flow';
import type { ChipRef } from '@/application/today-scope';
import { isAuthoredReference } from '@/domain/ids';
import { FlowShell } from '@/features/plan/viz/flow-viewer/flow-shell.client';
import { Button } from '@/ui/button';
import { Callout } from '@/ui/callout';
import { Chip, ChipList } from '@/ui/chip';
import { List, ListItem } from '@/ui/list';
import { InlineMarkdown, Markdown } from '@/ui/markdown';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

function Chips({ chips }: { readonly chips: readonly ChipRef[] }) {
  return chips.length === 0 ? null : (
    <ChipList>
      {chips.map((chip) => (
        <Chip key={chip.id} {...chip} />
      ))}
    </ChipList>
  );
}
function Sources({ sources }: { readonly sources: ModelFlowSources }) {
  return (
    <Stack gap={1}>
      <Chips chips={sources.evidence} />
      {sources.code.map((source) => (
        <a href={source.href} key={source.href}>
          {source.label}
        </a>
      ))}
    </Stack>
  );
}
function Named({ title, chips }: { readonly title: string; readonly chips: readonly ChipRef[] }) {
  return chips.length === 0 ? null : (
    <Stack gap={1}>
      <Text tone="muted">{title}</Text>
      <Chips chips={chips} />
    </Stack>
  );
}
function Prose({ title, text }: { readonly title: string; readonly text: string | undefined }) {
  return text === undefined ? null : (
    <Stack gap={1}>
      <Text tone="strong" weight="strong">
        {title}
      </Text>
      <Markdown isReference={isAuthoredReference} text={text} />
    </Stack>
  );
}
function StepDetails({ step }: { readonly step: ModelFlowStep }) {
  return (
    <Stack gap={3}>
      <Text as="h3" size="lg" weight="strong">
        {step.source.action}
      </Text>
      <Cluster>
        <Chip {...step.from} />
        <span>→</span>
        <Chip {...step.to} />
        {step.via === null ? null : <Chip {...step.via} />}
      </Cluster>
      {step.source.transport === undefined ? null : (
        <Text tone="muted">Transport: {step.source.transport}</Text>
      )}
      <Prose text={step.source.logic} title="Logic" />
      <Prose text={step.source.fails} title="Failure" />
      <Named chips={step.reads} title="Reads" />
      <Named chips={step.writes} title="Writes" />
      <Named chips={step.purges} title="Purges" />
      {step.screen === null ? null : <Named chips={[step.screen]} title="Screen" />}
      {step.source.beat === undefined ? null : <Text>Beat: {step.source.beat}</Text>}
      {step.source.case === undefined ? null : <Text>Cache case: {step.source.case}</Text>}
      {step.backing === null ? (
        <Text tone="muted">No handler backing is named on this narrated step.</Text>
      ) : (
        <Named chips={[step.backing]} title="Recorded handler step" />
      )}
      {step.entryHref === null ? null : <Link href={step.entryHref}>Open the entry flow →</Link>}
      <Sources sources={step.sources} />
    </Stack>
  );
}
function Sequence({ flow }: { readonly flow: ModelFlowView }) {
  return (
    <List>
      {flow.steps.map((step, at) => (
        <ListItem key={step.id} position={at}>
          <Stack gap={2}>
            <span data-step={String(step.number)}>
              <Button
                variant="link"
                label={`Read step ${String(step.number)}: ${step.source.action}`}
              >
                {String(step.number)}. {step.source.action}
              </Button>
            </span>
            <Cluster>
              <Chip {...step.from} />
              <span>→</span>
              <Chip {...step.to} />
              {step.via === null ? null : <Chip {...step.via} />}
            </Cluster>
          </Stack>
        </ListItem>
      ))}
    </List>
  );
}
/** Walk the recorded narrative without turning its steps into implementation claims. */
export function ModelTodayFlow({
  flow,
  stepKeys = true,
}: {
  readonly flow: ModelFlowView;
  readonly stepKeys?: boolean;
}) {
  return (
    <Stack gap={3}>
      <Text as="h3" size="lg" tone="strong" weight="strong">
        {flow.name}
      </Text>
      <Text tone="muted">Authored narrative. Entry flows show recorded implementation detail.</Text>
      {flow.actor === '' ? null : <Text>Actor: {flow.actor}</Text>}
      <Stack gap={1}>
        {flow.source.trigger === undefined ? null : (
          <span>
            <strong>Starts when</strong>{' '}
            <InlineMarkdown isReference={isAuthoredReference} text={flow.source.trigger} />
          </span>
        )}
        {flow.source.outcome === undefined ? null : (
          <span>
            <strong>Ends with</strong>{' '}
            <InlineMarkdown isReference={isAuthoredReference} text={flow.source.outcome} />
          </span>
        )}
      </Stack>
      {flow.steps.length === 0 ? (
        <Callout title="No narrated steps">This flow has no recorded steps.</Callout>
      ) : (
        <FlowShell
          diagram={null}
          stepKeys={stepKeys}
          sequence={<Sequence flow={flow} />}
          view="sequence"
          views={['sequence']}
          keys={{
            diagram: null,
            sequence: <Text tone="muted">Steps in their authored order</Text>,
          }}
          stops={flow.steps.map((step, at) => ({
            key: step.id,
            title: step.source.action,
            indices: [at],
            focus: null,
            strip: null,
            side: <StepDetails step={step} />,
          }))}
          hint="Choose a step or use the arrow keys to walk the narrative. Open a name for its recorded details."
        />
      )}
      <Sources sources={flow.sources} />
      {flow.gaps.length === 0 ? null : (
        <Callout title="Gaps">
          <ul>
            {flow.gaps.map((gap, at) => (
              <li key={`${gap.id}:${gap.kind}:${String(at)}`}>{gap.message}</li>
            ))}
          </ul>
        </Callout>
      )}
    </Stack>
  );
}
