import { modelInspectionRef } from '@/application/model-inspection';
import type { ModelPlanProgress } from '@/application/model-progress';
import type { ModelQueryContext } from '@/application/model-reader';
import { ModelPlanProgressFeed } from '@/features/plan/model-plan-progress';
import { CopyButton } from '@/features/plan/viz/board/copy-button.client';
import { Badge } from '@/ui/badge';
import { CodeBlock } from '@/ui/code-block';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

function IssueState({
  progress,
  id,
}: {
  readonly progress: ModelPlanProgress;
  readonly id: string;
}) {
  const status = progress.status[id];
  return (
    <>
      <Badge tone={status?.state === 'closed' ? 'added' : 'neutral'}>
        {status?.state ?? 'GitHub state unknown'}
      </Badge>
      {status?.closed_at === undefined ? null : <Text>Closed {status.closed_at}</Text>}
      {status?.url === undefined ? null : <TextLink href={status.url}>GitHub issue</TextLink>}
    </>
  );
}
/** Delivery observations stay separate from model facts and never imply an unrecorded GitHub state. */
export function NativeProgress({
  context,
  id,
}: {
  readonly context: ModelQueryContext;
  readonly id: string;
}) {
  const progress = context.progress;
  if (context.plan === null || progress === undefined || progress === null) return null;
  const work = (context.plan.work_items ?? []).find((item) => item.id === id);
  if (work === undefined && !progress.events.some((event) => event.subject === id)) return null;
  return (
    <Stack gap={2}>
      <Text as="h3" weight="strong">
        Progress
      </Text>
      {work === undefined ? null : (
        <section aria-label="Its GitHub issue">
          <Stack gap={2}>
            <Text weight="strong">{work.title}</Text>
            <IssueState progress={progress} id={id} />
            {work.body === undefined ? null : (
              <details>
                <summary>Recorded work description</summary>
                <CodeBlock
                  label="Work description"
                  action={<CopyButton text={work.body}>Copy as text</CopyButton>}
                >
                  {work.body}
                </CodeBlock>
              </details>
            )}
          </Stack>
        </section>
      )}

      <ModelPlanProgressFeed
        progress={progress}
        labelOf={(reference) => modelInspectionRef(context, reference).label}
        subject={id}
      />
    </Stack>
  );
}
