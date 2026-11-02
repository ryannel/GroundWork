import { useState } from 'react';

import type { ExplorerPage } from '@/domain/service-explorer';
import { Button } from '@/ui/button';
import { List, ListItem } from '@/ui/list';
import { SearchField } from '@/ui/search-field';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

export function ExplorerIndex({
  page,
  onOpen,
}: {
  readonly page: ExplorerPage;
  readonly onOpen: (file: string) => void;
}) {
  const [query, setQuery] = useState('');
  const nodes = page.nodes.filter((node) =>
    node.label.toLocaleLowerCase('en-GB').includes(query.toLocaleLowerCase('en-GB')),
  );
  return (
    <Stack gap={3}>
      <SearchField label="Find in this index" onChange={setQuery} value={query} />
      <List>
        {nodes.map((node) => (
          <ListItem key={node.id}>
            <Stack gap={1}>
              {node.target === null ? (
                <Text weight="strong">{node.label}</Text>
              ) : (
                <Button
                  variant="link"
                  onClick={() => {
                    if (node.target !== null) onOpen(node.target);
                  }}
                >
                  {node.label}
                </Button>
              )}
              <Text size="sm" tone="muted">
                {node.detail}
              </Text>
              {page.sources
                .filter((source) => node.sourceIds.includes(source.id))
                .map((source) => (
                  <TextLink key={source.id} href={source.url}>
                    {source.label}
                  </TextLink>
                ))}
            </Stack>
          </ListItem>
        ))}
      </List>
      {nodes.length === 0 ? (
        <Text as="p" tone="muted">
          No matching items in this index.
        </Text>
      ) : null}
    </Stack>
  );
}
