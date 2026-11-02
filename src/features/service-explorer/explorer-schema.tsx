import type { ExplorerPage } from '@/domain/service-explorer';
import { Button } from '@/ui/button';
import { DataTable } from '@/ui/data-table';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

export function ExplorerSchema({
  page,
  onOpen,
}: {
  readonly page: ExplorerPage;
  readonly onOpen: (target: string) => void;
}) {
  const nested = page.nodes.filter((node) => node.target !== null);
  return (
    <Stack gap={3}>
      {page.fields.length === 0 ? (
        <Text as="p" tone="muted">
          No field structure was delivered for this selection. This does not establish an empty
          schema.
        </Text>
      ) : (
        <DataTable
          caption={page.title}
          captionHidden
          columns={[
            { key: 'field', label: 'Field and type' },
            { key: 'presence', label: 'Presence', compact: true },
            { key: 'source', label: 'Source', compact: true },
          ]}
          rows={page.fields.map((field) => ({
            key: field.name,
            cells: {
              field: (
                <Text mono size="sm">
                  {field.name}: {field.type}
                </Text>
              ),
              presence: (
                <Stack gap={0}>
                  <Text size="sm">Required: {field.required}</Text>
                  <Text size="sm" tone="muted">
                    Nullable: {field.nullable}
                  </Text>
                </Stack>
              ),
              source: page.sources
                .filter((source) => field.sourceIds.includes(source.id))
                .slice(0, 1)
                .map((source) => (
                  <TextLink href={source.url} key={source.id}>
                    Field source
                  </TextLink>
                )),
            },
          }))}
        />
      )}
      {nested.length === 0 ? null : (
        <Stack gap={2} label="Referenced structures">
          <Text as="h3" weight="strong">
            Referenced structures
          </Text>
          {nested.map((node) => (
            <Button
              key={node.id}
              onClick={() => {
                if (node.target !== null) onOpen(node.target);
              }}
              variant="link"
            >
              {node.label}
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
