import type { ProgrammeRowVM } from '@/application/workspace-work/programme-page';
import { plural } from '@/shared/text';
import { List, ListItem } from '@/ui/list';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

function Held({ row }: { readonly row: ProgrammeRowVM }) {
  const counts = `${plural(row.plans, 'plan')} · ${row.blocked === 0 ? 'none' : String(row.blocked)} held up`;
  return (
    <Text size="sm" tone="muted">
      {counts}
      {row.nextBlocked === null ? null : (
        <>
          {' · next held up: '}
          <TextLink href={row.nextBlocked.href}>{row.nextBlocked.title}</TextLink>
        </>
      )}
    </Text>
  );
}

/** The programmes as a list: each with its outcome, how many plans it gathers, and the next one held up. */
export function ProgrammeRows({ rows }: { readonly rows: readonly ProgrammeRowVM[] }) {
  return (
    <List>
      {rows.map((row) => (
        <ListItem key={row.id}>
          <Stack gap={1}>
            <TextLink href={row.href} tone="title">
              {row.title}
            </TextLink>
            <Text as="p" clamp={2}>
              {row.outcome}
            </Text>
            <Held row={row} />
          </Stack>
        </ListItem>
      ))}
    </List>
  );
}
