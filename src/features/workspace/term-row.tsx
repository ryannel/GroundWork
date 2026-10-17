import type { TermRow as Row } from '@/application/language-page';
import { Button } from '@/ui/button';
import { ListItem } from '@/ui/list';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { TermFitBadge } from './term-fit';

interface TermRowProps {
  readonly row: Row;
  readonly chosen: boolean;
  readonly onPick: (id: string | null) => void;
}

/** One word in the list: its name, how it fits the code, and the first sentence of what it means. */
export function TermRow({ row, chosen, onPick }: TermRowProps) {
  return (
    <ListItem chosen={chosen}>
      <Button
        onClick={() => {
          onPick(chosen ? null : row.id);
        }}
        pressed={chosen}
        variant="bare"
      >
        <Stack as="span" gap={1}>
          <Cluster align="baseline" as="span">
            <Text size="lg" tone="strong" weight="strong">
              {row.name}
            </Text>
            {row.kind === 'key' ? <TermFitBadge fit={row.fit} /> : null}
          </Cluster>
          {row.gist === '' ? null : <Text clamp={2}>{row.gist}</Text>}
          {row.aliases.length === 0 ? null : (
            <Text size="sm" tone="faint">
              Also {row.aliases.join(', ')}
            </Text>
          )}
        </Stack>
      </Button>
    </ListItem>
  );
}
