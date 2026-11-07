import type { ReactNode } from 'react';

import type {
  ModelPartnerPage,
  ModelProgrammePage,
  ModelWorkPlanView,
} from '@/application/model-workspace-work';
import { thingAt } from '@/application/thing-paths';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { ModelPlanProgressFeed } from './model-plan-progress';
import { ModelPlanValue, type ModelPlanLabelLookup } from './model-plan-record';
import { WorkCard } from './work/work-card';

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Stack as="section" label={title}>
      <SectionHeading title={title} />
      {children}
    </Stack>
  );
}
function WorkPlan({
  plan,
  lookup: outerLookup,
}: {
  readonly plan: ModelWorkPlanView;
  readonly lookup: ModelPlanLabelLookup;
}) {
  const lookup: ModelPlanLabelLookup = {
    labelOf: (id) => plan.references[id]?.label ?? outerLookup.labelOf(id),
    hrefOf: (id) => plan.references[id]?.href ?? null,
  };
  let landing = 'Plan landing status is unknown.';
  if (plan.landed !== null) {
    landing = plan.landed
      ? 'Plan has a recorded landed base.'
      : 'Open plan; no landed base is recorded.';
  }
  const updates =
    plan.progress === null ? (
      <Text as="p">Progress could not be loaded.</Text>
    ) : (
      <ModelPlanProgressFeed
        progress={plan.progress}
        labelOf={lookup.labelOf}
        hrefOf={lookup.hrefOf}
      />
    );
  return (
    <Section title={plan.title}>
      <TextLink href={plan.href}>Open plan</TextLink>
      <Text as="p">{landing}</Text>
      <Text as="p">Dependency health has not been evaluated on this page.</Text>
      {plan.buildsOn.length === 0 ? (
        <Text as="p">Builds on today.</Text>
      ) : (
        <List>
          {plan.buildsOn.map((base) => (
            <ListItem key={base.id}>
              {base.href === null ? (
                <Text>{base.title} · Referenced plan not found</Text>
              ) : (
                <TextLink href={base.href}>{base.title}</TextLink>
              )}
            </ListItem>
          ))}
        </List>
      )}
      <Section title="Work items">
        {plan.work.length === 0 ? (
          <Text as="p">No assigned work items.</Text>
        ) : (
          <List>
            {plan.work.map((item) => (
              <ListItem key={item.source.id}>
                <Stack>
                  <WorkCard card={item.card} workspace={plan.workspace} />
                  <details>
                    <summary>Work item detail</summary>
                    <ModelPlanValue value={item.source} lookup={lookup} />
                  </details>
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Section>
      <Section title="Milestones">
        <ModelPlanValue value={plan.milestoneStanding} lookup={lookup} />
        <details>
          <summary>Authored milestone detail</summary>
          <ModelPlanValue value={plan.milestones} lookup={lookup} />
        </details>
      </Section>
      <Section title="Recorded updates">{updates}</Section>
    </Section>
  );
}
export function ModelPartnerPageView({
  page,
  labels,
}: {
  readonly page: ModelPartnerPage;
  readonly labels: Readonly<Record<string, string>>;
}) {
  const lookup = { labelOf: (id: string) => labels[id] ?? id };
  return (
    <Stack>
      <PageHeader
        title={page.team.name}
        description="Recorded contacts, assigned work and independent updates for this partner."
      />
      <Section title="Team and contacts">
        <ModelPlanValue value={page.team} lookup={lookup} />
      </Section>
      {page.plans.length === 0 ? (
        <Text as="p">No work in any plan is assigned to this partner.</Text>
      ) : (
        page.plans.map((plan) => <WorkPlan key={plan.slug} plan={plan} lookup={lookup} />)
      )}
    </Stack>
  );
}
export function ModelProgrammePageView({
  page,
  labels,
  href,
  selected,
  canInspect,
}: {
  readonly page: ModelProgrammePage;
  readonly labels: Readonly<Record<string, string>>;
  readonly href: string;
  readonly selected: string;
  readonly canInspect: (id: string) => boolean;
}) {
  const lookup = { labelOf: (id: string) => labels[id] ?? id };
  const active = page.plans.find((plan) => plan.slug === selected) ?? page.plans[0];
  return (
    <Stack>
      <PageHeader title={page.programme.title} description={page.programme.outcome} />
      <Section title="Programme">
        <ModelPlanValue value={page.programme} lookup={{ ...lookup, canInspect }} />
      </Section>
      <Section title="Where its plans land">
        {page.landing.length === 0 ? (
          <Text as="p">No domain placement is recorded for these plans.</Text>
        ) : (
          <List>
            {page.landing.map((domain) => (
              <ListItem key={domain.id}>
                <TextLink href={domain.href}>{domain.name}</TextLink>
                <Text>{String(domain.plans)} plans</Text>
              </ListItem>
            ))}
          </List>
        )}
        {page.gaps.map((gap) => (
          <Text as="p" key={`${gap.id}:${gap.kind}:${gap.message}`}>
            {gap.message}
          </Text>
        ))}
      </Section>
      <Section title="Partner dependencies">
        {page.partnerDependencies.length === 0 ? (
          <Text as="p">No partner dependencies are recorded.</Text>
        ) : (
          <List>
            {page.partnerDependencies.map(({ plan, href: planBase, item }) => (
              <ListItem key={`${planBase}:${item.id}`}>
                <Stack gap={1}>
                  <TextLink href={thingAt(`${planBase}things/`, item.id)}>{item.title}</TextLink>
                  <Text>
                    {plan} · {lookup.labelOf(item.team)}
                  </Text>
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Section>
      {page.plans.length < 2 ? null : (
        <Section title="Plans in this programme">
          <List>
            {page.plans.map((plan) => (
              <ListItem key={plan.slug}>
                {plan === active ? (
                  <Text weight="strong">{plan.title}</Text>
                ) : (
                  <TextLink href={`${href}?plan=${encodeURIComponent(plan.slug)}`}>
                    {plan.title}
                  </TextLink>
                )}
              </ListItem>
            ))}
          </List>
        </Section>
      )}
      {active === undefined ? (
        <Text as="p">No plans are assigned to this programme.</Text>
      ) : (
        <WorkPlan plan={active} lookup={lookup} />
      )}
    </Stack>
  );
}
