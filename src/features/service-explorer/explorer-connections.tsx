import type { ExplorerPage } from '@/domain/service-explorer';
import { Button } from '@/ui/button';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

export function ExplorerConnections({
  page,
  selected,
  onSelect,
}: {
  readonly page: ExplorerPage;
  readonly selected: string;
  readonly onSelect: (id: string) => void;
}) {
  const links = page.links.filter((link) => link.from === selected || link.to === selected);
  if (links.length === 0) return null;
  return (
    <Stack gap={2} label="Connections in this frame">
      <Text as="h3" weight="strong">
        Connections in this frame
      </Text>
      {links.map((link) => {
        const outgoing = link.from === selected;
        const other = page.nodes.find((node) => node.id === (outgoing ? link.to : link.from));
        if (other === undefined) return null;
        return (
          <Stack gap={0} key={link.id}>
            <Text size="sm" tone="muted">
              {outgoing ? 'To' : 'From'} · {link.label}
            </Text>
            <Button
              onClick={() => {
                onSelect(other.id);
              }}
              variant="link"
            >
              {other.label}
            </Button>
          </Stack>
        );
      })}
    </Stack>
  );
}
