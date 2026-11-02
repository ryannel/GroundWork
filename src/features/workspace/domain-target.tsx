import type { ReactNode } from 'react';

import type { TargetShiftView, TargetStageView, TargetView } from '@/application/workspace-target';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { Markdown } from '@/ui/markdown';
import { SectionHeading } from '@/ui/section-heading';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { RefChip, RefChips } from './ref-chip';

type Refs = TargetView['refs'];

function Prose({ text, refs }: { readonly text: string | null; readonly refs: Refs }) {
  if (text === null || text === '') return null;
  const renderRef = (id: string) => {
    const chip = refs[id];
    return chip === undefined ? <code>{id}</code> : <RefChip chip={chip} />;
  };
  return <Markdown renderRef={renderRef} text={text} />;
}

function Shift({ shift, refs }: { readonly shift: TargetShiftView; readonly refs: Refs }) {
  return (
    <ListItem>
      <Stack gap={2}>
        <Text as="h3" size="lg" tone="strong" weight="strong">
          {shift.name}
        </Text>
        <Text caps mono size="sm" tone="faint">
          Today
        </Text>
        <Prose refs={refs} text={shift.today} />
        <Text caps mono size="sm" tone="faint">
          Target
        </Text>
        <Prose refs={refs} text={shift.target} />
        <RefChips chips={shift.cites} />
      </Stack>
    </ListItem>
  );
}

function Stage({ stage, refs }: { readonly stage: TargetStageView; readonly refs: Refs }) {
  return (
    <ListItem id={`stage-${stage.id}`}>
      <Stack gap={2}>
        <Text as="h3" size="lg" tone="strong" weight="strong">
          {stage.name}
        </Text>
        <Prose refs={refs} text={stage.summary} />
        <RefChips chips={stage.owners} />
      </Stack>
    </ListItem>
  );
}

/** The stages in the order the flow reads: left to right, then top to bottom. */
function readingOrder(target: TargetView): readonly TargetStageView[] {
  const at = new Map(target.flow.cards.map((card) => [card.id, card]));
  const x = (stage: TargetStageView) => at.get(stage.id)?.x ?? 0;
  const y = (stage: TargetStageView) => at.get(stage.id)?.y ?? 0;
  return target.stages.toSorted((a, b) => (x(a) === x(b) ? y(a) - y(b) : x(a) - x(b)));
}

/** Where a domain is heading: the flow it aims for, each stage in words, and the shifts from today. */
export function DomainTarget({
  target,
  flow,
}: {
  readonly target: TargetView | null;
  /** The stages drawn as a flow, from target.flow. */
  readonly flow?: ReactNode;
}) {
  if (target === null) {
    return (
      <Callout title="No target architecture yet">
        <p>
          Write where this domain is heading in <code>target.yaml</code> beside its{' '}
          <code>domain.yaml</code>: a <code>summary</code>, the <code>stages</code> of the flow it
          aims for with the systems that should own each, and the <code>shifts</code> from today.
        </p>
      </Callout>
    );
  }
  const { refs } = target;
  return (
    <Stack gap={6}>
      <Prose refs={refs} text={target.summary} />
      {target.stages.length === 0 ? null : (
        <Stack as="section" gap={3} label="Flow">
          <SectionHeading title="Flow">
            What the domain makes, left to right, and the systems that should own each stage.
            Separate lanes of supply meet where they are used.
          </SectionHeading>
          {flow}
          <List>
            {readingOrder(target).map((stage) => (
              <Stage key={stage.id} refs={refs} stage={stage} />
            ))}
          </List>
        </Stack>
      )}
      {target.shifts.length === 0 ? null : (
        <Stack as="section" gap={3} label="Shifts">
          <SectionHeading title="Shifts">
            Where today differs from the target, and which way it is moving.
          </SectionHeading>
          <List>
            {target.shifts.map((shift) => (
              <Shift key={shift.id} refs={refs} shift={shift} />
            ))}
          </List>
        </Stack>
      )}
    </Stack>
  );
}
