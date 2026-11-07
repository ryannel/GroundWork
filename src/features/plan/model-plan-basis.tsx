import type { ModelIndex } from '@/application/model-index';
import type { ModelPlanBasis } from '@/application/model-plan-pages';
import { baseLine } from '@/application/plan-story-cover-base';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

/** The selected native basis and independent check history, never an earlier format's drift hashes. */
export function ModelPlanBasisNotice({
  basis,
  index,
  show = true,
}: {
  readonly basis: ModelPlanBasis | null;
  readonly show?: boolean;
  readonly index: ModelIndex;
}) {
  if (!show || basis === null || basis.base.mode === 'none') return null;
  const previous = basis.base.previousCheckedOn;
  const line = baseLine(basis.base, index.label, new Date());
  return (
    <Callout
      title="Plan basis"
      tone={previous !== undefined || line?.tone === 'warn' ? 'warning' : 'note'}
    >
      <Stack gap={1}>
        <Text as="p">
          {previous === undefined
            ? line?.text
            : `Previously checked on ${previous} in the previous model format. Recheck this plan against the consolidated model; the earlier hashes do not establish current drift.`}
        </Text>
        {basis.readsAfter.length === 0 ? null : (
          <>
            <Text as="p">
              Reads the systems after these proposed plans. Their effects remain unverified until
              supported by current evidence.
            </Text>
            <List dense>
              {basis.readsAfter.map((plan) => (
                <ListItem key={plan.id}>
                  <TextLink href={plan.href}>{plan.title}</TextLink>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Stack>
    </Callout>
  );
}
