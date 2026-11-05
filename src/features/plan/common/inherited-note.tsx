import type { Model } from '@/application/plan/derive';
import { inheritedNotesOf } from '@/application/plan-inherited';
import { Badge } from '@/ui/badge';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

interface InheritedNoteProps {
  readonly model: Model;
  /** What the screen or page shows; their parts are looked at too. */
  readonly ids: readonly string[];
}

/**
 * What a plan below this one added or changed and is not live yet, said once per group: "Added by Sales tool · not
 * live yet", then what it covers when that is more than one thing. Nothing when the plan inherits none of it.
 */
export function InheritedNote({ model, ids }: InheritedNoteProps) {
  const groups = inheritedNotesOf(model, ids);
  if (groups.length === 0) return null;
  return (
    <Stack gap={1} label="Not live yet">
      {groups.map((group) => (
        <Cluster gap={2} key={`${group.plan}\n${group.kind}`}>
          <Badge tone="accent">{group.text}</Badge>
          {group.ids.length > 1 ? (
            <Text size="sm" tone="body">
              {group.ids.map((id) => model.label(id)).join(', ')}
            </Text>
          ) : null}
        </Cluster>
      ))}
    </Stack>
  );
}
