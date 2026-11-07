import { modelFlowMermaidOf, modelFlowOf } from '@/application/model-flow';
import type { ModelIndex } from '@/application/model-index';
import { modelText } from '@/domain/workspace-model';
import { ModelTodayFlow } from '@/features/plan/today/model-today-flow';
import { CopyButton } from '@/features/plan/viz/board/copy-button.client';
import { CopyMermaid } from '@/features/plan/viz/flow-viewer/copy-mermaid.client';
import { CodeBlock } from '@/ui/code-block';
import { Stack } from '@/ui/stack';

/** Copy the exact query or a drawing of the authored narrative from the selected model. */
export function NativeInspectionExtras({
  index,
  id,
}: {
  readonly index: ModelIndex;
  readonly id: string;
}) {
  const node = index.get(id);
  if (node?.kind === 'flow') {
    const flow = modelFlowOf(index, id);
    return flow === null ? null : (
      <Stack gap={2}>
        <ModelTodayFlow flow={flow} stepKeys={false} />
        <CopyMermaid text={modelFlowMermaidOf(flow)} />
      </Stack>
    );
  }
  const document = node?.kind === 'operation' ? modelText(node.data.document) : null;
  return document === null ? null : (
    <CodeBlock
      label="Recorded query"
      action={<CopyButton text={document}>Copy the query</CopyButton>}
    >
      {document}
    </CodeBlock>
  );
}
