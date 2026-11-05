import type { ExplorerRepositoryLink } from '@/application/explorer-component-links';
import { Text, TextLink } from '@/ui/text';

export function CapturedRepositories({
  links,
}: {
  readonly links: readonly ExplorerRepositoryLink[];
}) {
  if (links.length === 0) return null;
  return (
    <Text as="p" size="sm" tone="muted">
      Captured repositories:{' '}
      {links.map((link, index) => (
        <span key={link.label}>
          {index === 0 ? '' : '; '}
          <TextLink href={link.href}>{link.label}</TextLink>
          {` (${link.revision})`}
        </span>
      ))}
    </Text>
  );
}
