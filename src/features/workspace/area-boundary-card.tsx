import type { AreaBoundaryView } from '@/application/workspace-area';
import { ComponentCard, ComponentCardHeader } from '@/ui/canvas/component-card';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

/** A model boundary is inspected as itself and never expands into an invented component. */
export function AreaBoundaryCard({
  boundary,
  muted,
  highlighted,
  onSelect,
}: {
  readonly boundary: AreaBoundaryView;
  readonly muted: boolean;
  readonly highlighted: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <ComponentCard
      active={false}
      muted={muted}
      highlighted={highlighted}
      footerSize="content"
      header={
        <ComponentCardHeader
          icon="system"
          tone="neutral"
          kind={boundary.boundaryKind === 'system' ? 'System boundary' : 'External boundary'}
          name={boundary.name}
          summary={boundary.summary}
          onOpen={onSelect}
        />
      }
      footer={
        <Stack gap={1}>
          <Text size="sm" tone="muted">
            {boundary.gaps[0] ?? 'Declared boundary; implementation details are not implied.'}
          </Text>
        </Stack>
      }
    />
  );
}
