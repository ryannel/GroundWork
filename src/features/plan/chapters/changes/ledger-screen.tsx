import { ledgerClaim } from '@/application/plan-story-changes-claims';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Ledger } from '@/features/plan/viz/ledger/ledger';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';

/** Every change, grouped by the service it changes, or by the team that builds it. */
export function LedgerScreen({ model, outline, page }: BodyProps) {
  const { headline, lede } = ledgerClaim(model);
  const tabs = [
    { label: 'By component', content: <Ledger groupBy="service" model={model} /> },
    ...(model.plan.teams.length > 1
      ? [{ label: 'By team', content: <Ledger groupBy="team" model={model} /> }]
      : []),
  ];
  return (
    <>
      <ScreenHead headline={headline} outline={outline} page={page}>
        <p>{lede}</p>
      </ScreenHead>
      <SegTabs label="Group changes by" tabs={tabs} />
    </>
  );
}
