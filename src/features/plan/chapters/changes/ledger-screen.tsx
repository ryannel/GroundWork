import { ledgerClaim } from '@/application/plan-story-changes-claims';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Ledger } from '@/features/plan/viz/ledger/ledger';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';

/** Every change, grouped by the component it changes, or by the team that builds it; each grouping is a stop. */
export function LedgerScreen({ model, outline, page }: BodyProps) {
  const { headline, lede } = ledgerClaim(model);
  const tabs = [
    {
      key: 'component',
      label: 'By component',
      content: <Ledger groupBy="service" model={model} />,
    },
    ...(model.plan.teams.length > 1
      ? [{ key: 'team', label: 'By team', content: <Ledger groupBy="team" model={model} /> }]
      : []),
  ];
  return (
    <>
      <ScreenHead headline={headline} outline={outline} page={page}>
        <p>{lede}</p>
      </ScreenHead>
      <SegTabs label="Group changes by" stepped tabs={tabs} />
    </>
  );
}
