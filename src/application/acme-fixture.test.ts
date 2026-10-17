import { describe, expect, it } from 'vitest';

import { pauseOrders, pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import { planDataOf, planOnAcme } from '@/../test/plan-kit';
import { acme } from '@/../test/workspace-kit';
import { validatePlan } from '@/application/plan/validate-plan';
import { languageWarnings } from '@/application/workspace-language';
import { componentsOf } from '@/domain/workspace';
import { checkWorkspace } from '@/domain/workspace-check';

const { workspace, model, today } = acme();

describe('the Acme fixture', () => {
  it('is a workspace with no problems', () => {
    expect(checkWorkspace(workspace)).toEqual({ errors: [], warnings: [] });
    expect(languageWarnings(workspace, model)).toEqual([]);
  });

  it('gives every component its own id', () => {
    const ids = componentsOf(workspace).map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws a today the plan checks accept', () => {
    expect(validatePlan(today.plan)).toEqual({ errors: [], warnings: [] });
    expect(today.model.validation().errors).toEqual([]);
    expect(today.model.asIs.flows).toHaveLength(model.flows.length);
  });

  it('links domains to each other', () => {
    const domainOf = new Map(
      workspace.domains.flatMap((domain) =>
        domain.systems.flatMap((system) => system.components.map(({ id }) => [id, domain.id])),
      ),
    );
    const across = componentsOf(workspace).flatMap((component) =>
      component.talksTo.filter(({ to }) => domainOf.get(to) !== domainOf.get(component.id)),
    );
    expect(across.length).toBeGreaterThan(0);
  });
});

describe('the pause-orders example plan', () => {
  it('goes onto Acme with no problems', () => {
    expect(planOnAcme(pauseOrdersOverlay())).toMatchObject({ errors: [], warnings: [] });
    expect(validatePlan(pauseOrders())).toEqual({ errors: [], warnings: [] });
  });

  it('has pages', () => {
    const data = planDataOf(pauseOrders());
    expect(data.outline.pages.length).toBeGreaterThan(0);
    expect(data.plans.map(({ id }) => id)).toEqual(['pause-orders']);
  });
});
