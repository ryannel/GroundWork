# Work with the consolidated model

Use the [rebuild design](../../../docs/rebuild/design.md) for the model layout and the
[Groundwork schema skill](SKILL.md) for the owning schema and validator. The [previous cookbook](../../../docs/rebuild/archive/legacy-plan-cookbook.md)
is retained for reading historical fixtures.

## Record current facts

Put a system's identity, code homes and components in `system.yaml`. Put entries, messages, subscriptions,
jobs, interactions, operations and schemas in `contracts.yaml`. Executable logic lives in
`handlers/<component>.yaml`. Screens and regions live in `screens.yaml` with the owning app ID.

```yaml
- id: h:confirm-order
  component: svc:ordering
  on: api:confirm-order
  cites: [ordering:src/confirm.ts#L14-34]
  steps:
    - id: load-order
      read: sch:order
      from: st:orders
      cites: ['#L18-20']
```

An inherited line range needs one unambiguous code file on its handler. Otherwise, cite the file and
its home explicitly. When the pin has moved and the record is historical, keep its full commit. Evidence
records use persisted `ev:` IDs. A current effect has a citation even if some detail remains unknown.

## Propose changes

A plan is an overlay in `plans/<plan>/plan.yaml`. Keep its reasons, decisions, risks, tests, work,
milestones and dependencies with the change they explain. Operations name declared IDs in the current
model or in explicitly ordered plan ancestors. To change a step, use its full address.

```yaml
- modify: h:confirm-order#load-order
  set:
    say: Read the saved order
```

Use `add` with the exact entity kind and its owning ID, `modify` for an existing record, `deprecate`
with a successor when known, or `remove` with its reason. Follow the native plan schema for each op
shape. When adding a child, declare a stable local ID. Use the same ID when a later plan changes it.

Proposed effects can have implementation evidence gaps. Keep their attribution in the plan. Add
implementation evidence before promoting any such effect into the current model.

## Review and land

`npm run plan:base -- check <plan> --workspace <ws>` checks the overlay on its declared base.
`npm run workspace -- check <folder>` validates the full workspace and its plan projections.
When the change ships, use `plan:base -- land` in dependency order. The plan keeps its frozen
`base/` with the `base.yaml` marker. Keep progress beside the plan in `progress.yaml`.
