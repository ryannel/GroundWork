import { Fragment } from 'react';

import { shortDate } from '@/application/plan-viz-state';
import type { StackCoverVM } from '@/application/workspace-work/stack-cover';
import { CopyButton } from '@/features/plan/viz/board/copy-button.client';
import { CodeBlock } from '@/ui/code-block';
import { List, ListItem } from '@/ui/list';
import { Panel } from '@/ui/panel';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import styles from './stack-section.module.css';

interface StackSectionProps {
  readonly stack: StackCoverVM;
  readonly today: Date | undefined;
}

function ReadsAfter({ stack, today }: StackSectionProps) {
  if (stack.readsAfter.length === 0) return null;
  return (
    <Stack gap={1}>
      <p className={styles.line}>
        <Text>Reads the systems after: </Text>
        {stack.readsAfter.map((base, i) => (
          <Fragment key={base.slug}>
            {i === 0 ? null : <Text>, </Text>}
            <TextLink href={base.href}>{base.title}</TextLink>
            <Text tone={base.changed ? 'strong' : 'muted'}>
              {base.changed ? ' — changed since this plan was checked' : ' ✓'}
            </Text>
          </Fragment>
        ))}
      </p>
      <Text size="sm" tone="muted">
        {stack.checkedOn === null
          ? 'Never checked against them.'
          : `Checked against them on ${shortDate(stack.checkedOn, today)}.`}
      </Text>
    </Stack>
  );
}

function InheritedWork({ stack }: Pick<StackSectionProps, 'stack'>) {
  if (stack.inheritedWork.length === 0) return null;
  return (
    <Stack gap={1}>
      <Text weight="strong">Not delivered yet by the plans it reads after</Text>
      <List dense>
        {stack.inheritedWork.flatMap(({ plan, items }) =>
          items.map((item) => (
            <ListItem key={item.key}>
              <Cluster gap={2}>
                <TextLink href={item.href} tone="title">
                  {item.title}
                </TextLink>
                <Text size="sm" tone="muted">
                  {[plan.title, item.team.name, item.progress?.state ?? 'not started'].join(' · ')}
                </Text>
              </Cluster>
            </ListItem>
          )),
        )}
      </List>
    </Stack>
  );
}

function Overlaps({ stack }: Pick<StackSectionProps, 'stack'>) {
  if (stack.overlaps.length === 0) return null;
  return (
    <Stack gap={1}>
      <Text weight="strong">Overlaps with plans it does not build on</Text>
      <List dense>
        {stack.overlaps.map((o) => (
          <ListItem key={`${o.target}\n${o.here.change}\n${o.there.change}`}>
            <p className={styles.line}>
              <Text>{`${o.words} `}</Text>
              <Text mono>{o.target}</Text>
              <Text>: </Text>
              <TextLink href={o.here.href}>{o.here.title}</TextLink>
              <Text> here, and </Text>
              <TextLink href={o.there.href}>{o.there.title}</TextLink>
              <Text>{` in ${o.there.planTitle}.`}</Text>
            </p>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}

/**
 * The plans around this one: the plans it reads after (each as checked, or changed since), their work not delivered
 * yet, the plans it overlaps, the programme it is part of, and the one command that checks it again.
 */
export function StackSection({ stack, today }: StackSectionProps) {
  const stacked = stack.readsAfter.length > 0 || stack.overlaps.length > 0;
  return (
    <section aria-label="The plans around it" className={styles.section}>
      <Panel>
        <Stack gap={3}>
          {stack.programme === null ? null : (
            <p className={styles.line}>
              <Text>Part of </Text>
              <TextLink href={stack.programme.href}>{stack.programme.title}</TextLink>
            </p>
          )}
          <ReadsAfter stack={stack} today={today} />
          <InheritedWork stack={stack} />
          <Overlaps stack={stack} />
          {stacked ? (
            <CodeBlock
              action={<CopyButton text={stack.recheck}>Copy</CopyButton>}
              label="Re-check it against them"
            >
              {stack.recheck}
            </CodeBlock>
          ) : null}
        </Stack>
      </Panel>
    </section>
  );
}
