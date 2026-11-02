import type { ExplorerRepositoryLink } from '@/application/explorer-component-links';
import { List, ListItem } from '@/ui/list';
import { Text, TextLink } from '@/ui/text';

export function CapturedRepositories({
  links,
}: {
  readonly links: readonly ExplorerRepositoryLink[];
}) {
  return (
    <List>
      {links.map((link) => (
        <ListItem key={link.label}>
          <TextLink href={link.href}>{link.label}</TextLink>{' '}
          <Text size="sm" tone="muted">
            Captured at {link.revision} · APIs, implementations, schemas and source
          </Text>
        </ListItem>
      ))}
    </List>
  );
}
