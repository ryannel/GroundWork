# Op cookbook

Every change in a plan is an op inside `changes[].ops`, against ids in the system model today.
Each recipe below is copy-pasteable; the ids are illustrative, from a subscriptions example (billing,
entitlements, a `subscription.status.changed` event). Swap in ids from your workspace's model (`npm run map --
find <words>`). `workspaces/alder-finch/plans/delivery-promise/plan.yaml` is a full worked example of the ops (and
`invoice-vat-number/plan.yaml` a small one).

Reminders:

- `modify` / `deprecate` / `remove` target ids that exist at that point in the ledger: in the model, or added by an earlier op. A later op can edit what an earlier change added.
- Ledger order matters for `into`, `after` and op targets: an `add` must come before an op that
  targets its container. Plain references (`via`, `payload`, `proves` …) may point anywhere in the ledger.
- Quote ids containing `#`.
- Every change still needs ≥ 1 test (`tests[].proves`) and ≥ 1 work item (`work_items[].implements`).
- Before/after, status badges and the migration ladder are derived from these ops. Write only the after-value.

Contents: [1 Add a field](#1-add-a-field-to-an-existing-record) · [2 Add an endpoint](#2-add-an-endpoint-to-an-existing-interface) ·
[3 New flow](#3-add-a-brand-new-flow) · [4 Insert a step](#4-insert-a-step-after-an-existing-one) ·
[5 Change logic](#5-change-a-steps-logic-or-any-scalar) · [6 Switch consumer](#6-switch-one-consumer-to-a-new-message-version) ·
[7 Version a message](#7-version-a-message-expand--migrate--contract) · [8 Retire and remove](#8-retire-and-remove) ·
[9 Store + access](#9-add-a-store-and-give-another-service-access) · [10 Widen an enum](#10-widen-an-enum) ·
[11 Deprecate an endpoint](#11-deprecate-an-endpoint-in-favour-of-a-new-one) · [12 Per-consumer migration](#12-per-consumer-migration-pattern) ·
[13 Smaller recipes](#13-smaller-recipes) · [14 What not to do](#14-what-not-to-do) · [15 Screens](#15-screens-a-new-look-a-new-region-a-new-screen) ·
[16–19 Graph](#16-graph-add-a-subgraph-and-a-field-that-needs-another-field) · [20 Handlers](#20-handlers-add-a-step-a-branch-or-a-new-handler)

---

## 1. Add a field to an existing record

```yaml
- id: chg:invoice-skip-reason
  title: 'Invoices record why a run skipped them'
  rollout: 'Additive nullable column; no backfill. Rollback: stop writing it.'
  ops:
    - add: field
      into: sch:invoice
      value:
        { name: skipped_reason, type: 'string?', note: 'Set only when the run set the row aside.' }
```

Screen: chapter 5 shows `sch:invoice` with `+ skipped_reason string?` in the diff gutter.
A field needs `into` (a schema id); its address becomes `sch:invoice#skipped_reason`. A field may also say
`key: true`, `ref: sch:customer` (or `sch:customer#id`), `default: "none"` and `unique: true` when the code does;
a message says `key: subscription_id` for the payload field it is keyed by.

## 2. Add an endpoint to an existing interface

```yaml
- id: chg:billing-skip-report
  title: 'Billing exposes a skip report'
  ops:
    - add: endpoint
      into: if:billing-grpc
      value:
        id: api:billing-skip-report
        sig: 'ListSkipped(run_date)'
        summary: 'Subscriptions the run set aside on a date.'
        response: sch:invoice
        auth: 'service token'
        idempotent: true
        errors: [{ status: 404, code: no_run, when: 'No run for that date' }]
```

If the endpoint needs a new request/response body, `add: schema` (kind `dto`) first in the same change.

## 3. Add a brand-new flow

A new journey is one `add: flow` carrying every step. Its new pieces (schemas, endpoints, messages)
are `add` ops in the same or an earlier change. Existing services, stores and messages are just referenced.

```yaml
- id: chg:skip-report-page
  title: 'Support can see why a member was not charged'
  ops:
    - add: flow
      value:
        id: flow:skip-report
        name: 'Look up a skipped charge'
        actor: 'Support agent'
        trigger: "Agent opens a member's billing tab."
        outcome: 'The agent sees the skip and its reason.'
        steps:
          - id: 'flow:skip-report#request'
            from: svc:web
            to: svc:billing # via api:* ⇒ `to` must be the api's service
            via: api:billing-skip-report
            action: 'Ask for skipped rows'
          - id: 'flow:skip-report#read'
            from: svc:billing
            to: svc:billing
            via: internal
            action: 'Read skipped invoices'
            reads: [sch:invoice] # svc:billing owns st:billing-db ✓
```

Screen: chapter 4 gets one screen for this flow, drawn over today's map.

## 4. Insert a step after an existing one

```yaml
- id: chg:access-miss-metric
  title: 'Count cache misses on the access check'
  ops:
    - add: step
      into: flow:access-check
      after: 'flow:access-check#read-cache' # omit `after` to append at the end
      value:
        id: 'flow:access-check#count-miss' # must start with the `into` flow id
        from: svc:entitlements
        to: svc:entitlements
        via: internal
        action: 'Count the miss'
        logic: 'Increment `entitlements_cache_miss_total`.'
```

`after` must be a step that exists at this point in the ledger (in the model, or added by an earlier op).

## 5. Change a step's logic (or any scalar)

```yaml
- id: chg:invoice-per-plan
  title: 'One invoice per plan line'
  ops:
    - modify: 'flow:billing-run#create-invoice'
      set:
        action: 'Create one invoice per plan line'
        logic: 'One draft invoice per plan line for the coming period.'
```

Author only the new value; chapter 5 shows before | after with a "You saw this in 3.x" link.
`set` replaces whole values (strings, refs, whole lists). It can change `from`, `to`, `via`, `reads`,
`writes`, `fails`, `beat`, `action`, `logic` — not `id`.

## 6. Switch one consumer to a new message version

Two ops: move the consumer's step to the new `via`, and drop it from the old message's consumers.
(The new message must already list it in `consumers`.)

```yaml
- id: chg:billing-reads-v2
  title: 'Billing consumes status.changed v2'
  rollout: 'Consumer switches on the `type` header; v1 handler deleted in the same PR.'
  ops:
    - { modify: 'flow:cancel#to-billing', set: { via: msg:status-changed-v2 } }
    - { modify: msg:status-changed-v1, drop: { consumers: [svc:billing] } }
```

## 7. Version a message (expand → migrate → contract)

**Expand** — new payload + new message that `supersedes` the old one, plus the dual-publish step:

```yaml
- id: chg:status-event-v2
  title: 'Version the status event to v2; dual-publish until M3'
  decisions: [dec:version-event]
  rollout: 'Relay writes v1 and v2 rows; flag `status_event_v2_publish`.'
  ops:
    - add: schema
      value:
        id: sch:status-changed-v2
        name: SubscriptionStatusChanged v2
        kind: payload
        fields:
          - { name: subscription_id, type: uuid, required: true }
          - { name: status, type: 'enum(active, paused, cancelled)', required: true }
    - add: message
      value:
        id: msg:status-changed-v2
        name: subscription.status.changed
        version: v2
        topic: st:subscription-events
        payload: sch:status-changed-v2
        producer: svc:subscriptions
        consumers: [svc:billing, svc:entitlements, svc:notify, svc:analytics]
        supersedes: msg:status-changed-v1
    - add: step
      into: flow:cancel
      after: 'flow:cancel#publish'
      value:
        {
          id: 'flow:cancel#publish-v2',
          from: svc:subscriptions,
          to: st:subscription-events,
          via: msg:status-changed-v2,
          action: 'Publish status change v2',
          reads: [sch:outbox-event],
        }
```

**Migrate** — one change per consumer (recipe 6, pattern 12).

**Contract** — deprecate with `replaced_by`, then stop publishing v1:

```yaml
- id: chg:retire-status-v1
  title: 'Retire the v1 status event'
  rollout: 'Flag off v1 in the relay; watch 24 h; delete v1 code.'
  ops:
    - { deprecate: msg:status-changed-v1, replaced_by: msg:status-changed-v2 }
    - { deprecate: sch:status-changed-v1, replaced_by: sch:status-changed-v2 }
    - { remove: 'flow:cancel#publish' }
```

The ladder (expand → migrate → contract) and the `New v2 · replaces v1` badge are derived from
`supersedes`, the `drop consumers` ops and this `deprecate`. While a to-be step still uses v1 you
get a warning (`… still uses msg:status-changed-v1 in the to-be, which … deprecates`): expected
during dual-publish; say so in `rollout`.

## 8. Retire and remove

- `deprecate` = still there, retiring (rose dashed). Use while anything still depends on it.
- `remove` = gone in the to-be. Removes children too (removing a schema removes its fields; a flow its steps).
- An id can be removed once. A to-be entity still referencing a removed id is an error, so migrate
  every user first (recipes 6, 11), then remove.
- Tests may still `walks` a removed step (that's how you prove the removal).

```yaml
- id: chg:drop-cancel-at
  title: 'Drop the unused cancel_at column'
  rollout: 'Stop writing in M2, drop the column in M3.'
  ops:
    - { deprecate: 'sch:subscription#cancel_at' } # replaced_by is optional
- id: chg:remove-cancel-at
  title: 'Remove cancel_at'
  ops:
    - { remove: 'sch:subscription#cancel_at' }
```

Deprecate and remove in _separate_ changes when they ship in different milestones, so each gets its
own work item and test.

## 9. Add a store and give another service access

```yaml
- id: chg:skip-cache
  title: 'Billing caches skip decisions; Analytics reads invoices directly'
  ops:
    - add: store
      value:
        {
          id: st:billing-skip-cache,
          name: billing-skip-cache,
          kind: cache,
          tech: 'Redis 7',
          owner: svc:billing,
          notes: 'One key per subscription and run date. TTL 48 h.',
        }
    - add: schema
      value:
        id: sch:skip-decision
        name: SkipDecision
        kind: record
        store: st:billing-skip-cache # records need a store
        fields: [{ name: subscription_id, type: uuid, required: true }]
    - { modify: st:billing-db, append: { access: [{ svc: svc:analytics, mode: read }] } }
    - add: flow
      value:
        id: flow:invoice-export
        name: 'Nightly invoice export'
        actor: 'Analytics'
        steps:
          - {
              id: 'flow:invoice-export#read',
              from: svc:analytics,
              to: st:billing-db,
              via: internal,
              action: "Read yesterday's invoices",
              reads: [sch:invoice],
            } # acting = from (to is a store)
```

Without the `append: { access: … }` op the last step fails invariant 6. Prefer a projection (a
record in the reader's own store, fed by events) over cross-team read access; grant access only
when that is really how production will work. `mode`: `read | write | readwrite`.

## 10. Widen an enum

```yaml
- { modify: 'sch:subscription#status', set: { type: 'enum(active, paused, cancelled)' } }
```

Also widen every copy that must hold the new value (projections, payloads, DTOs), each owned by its
team's change:

```yaml
- {
    modify: 'sch:billing-subscription-projection#status',
    set: { type: 'enum(active, paused, cancelled)' },
  }
```

Other field tweaks the same way: `set: { required: true }`, `set: { note: "…" }`. A field's `name`
cannot be set (remove + add).

## 11. Deprecate an endpoint in favour of a new one

```yaml
- id: chg:cancel-v2
  title: 'Cancel v2 takes a reason code'
  ops:
    - add: endpoint
      into: if:subs-rest
      value:
        {
          id: api:subs-cancel-v2,
          sig: 'POST /v2/subscriptions/{id}/cancel',
          request: sch:cancel-request,
          response: sch:subscription,
          auth: 'member session',
          idempotent: true,
          supersedes: api:subs-cancel,
        }
    - { modify: 'flow:cancel#request', set: { via: api:subs-cancel-v2 } } # move every caller
    - { deprecate: api:subs-cancel, replaced_by: api:subs-cancel-v2 }
```

Removing `api:subs-cancel` later is fine once no to-be step uses it; the v2 endpoint's
`supersedes` may keep pointing at the removed id.

## 12. Per-consumer migration pattern

For N consumers of a changed contract, write **one change per consumer**, owned by that consumer's
team, each with its own test (usually `level: contract`) and work item:

```yaml
- id: chg:entitlements-reads-v2
  title: 'Entitlements consumes status.changed v2'
  ops:
    - { modify: 'flow:cancel#to-entitlements', set: { via: msg:status-changed-v2 } }
    - { modify: msg:status-changed-v1, drop: { consumers: [svc:entitlements] } }
- id: chg:notify-reads-v2
  title: 'Notifications consumes status.changed v2'
  ops:
    - { modify: 'flow:cancel#to-notifications', set: { via: msg:status-changed-v2 } }
    - { modify: msg:status-changed-v1, drop: { consumers: [svc:notify] } }
```

Order: expand change (M1) → consumer changes (M2, parallel, each `depends_on` the expand work item)
→ contract change (M3, `depends_on` every consumer work item). The ladder screen shows each rung
with its work items.

## 13. Smaller recipes

```yaml
# Add a consumer to an existing message (+ its step)
- { modify: msg:invoice-charged, append: { consumers: [svc:entitlements] } }
- add: step
  into: flow:billing-run
  value:
    {
      id: 'flow:billing-run#to-entitlements',
      from: st:billing-events,
      to: svc:entitlements,
      via: msg:invoice-charged,
      action: 'Refresh access',
      beat: 'Fan out to consumers',
    }

# A step starts writing another record (list prop)
- {
    modify: 'flow:billing-run#create-invoice',
    append: { writes: [sch:billing-subscription-projection] },
  }

# Add an error code to an existing endpoint
- {
    modify: api:subs-cancel,
    append: { errors: [{ status: 423, code: locked, when: 'Account under review' }] },
  }

# A new service (e.g. a job) — then use it in an added flow or step
- add: service
  value:
    {
      id: svc:skip-auditor,
      name: 'Skip auditor',
      team: team:billing,
      kind: job,
      tech: 'Go · CronJob',
    }

# Systems and their components today live in the model (domains/<d>/systems/<s>/system.yaml), not the plan.
# A new system in a change: add the system, then set system on its parts
- add: system
  value: { id: sys:tax, name: 'Tax', team: team:billing, does: 'Works out tax on every invoice' }
- { modify: svc:tax-calculator, set: { system: sys:tax } }

# One service calls another with no modelled interface (a library over HTTP): still a line
- {
    id: flow:billing-run#tax,
    from: svc:billing-api,
    to: svc:tax-calculator,
    via: internal,
    action: 'Work out tax',
  }

# Move a record to another store
- { modify: sch:entitlement, set: { store: st:billing-db } } # every to-be reader/writer must then have access
```

## 14. What not to do

| Don't                                                                                 | Why / validator says                                                    | Do instead                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Put a new flow, step, field or consumer at the top level of the plan, or in the model | it silently becomes "today", and the model stops being true             | an `add` op                                                               |
| Write the new behaviour into today's step `logic` or handler                          | today shows it as running; the changes chapter has nothing to diff      | `modify … set: { logic }`, or an op on the `h:` handler                   |
| `modify` / `deprecate` / `remove` something added later in the ledger                 | `… is added later in the ledger, by …; move this modify after that add` | reorder, or put it in the `add` value                                     |
| `add: field into:` a schema the plan adds                                             | warning `… prefer putting this field in that add`                       | put the field in the schema's `fields`                                    |
| `add` an id that exists                                                               | `add id … collides with an existing id …; use modify instead`           | `modify`                                                                  |
| Copy a model entity into the plan with the new value                                  | collision error, and the diff is lost                                   | `modify` with only the changed props                                      |
| `set` a list to change one item                                                       | works, but the diff reads as whole-list replacement                     | `append` / `drop`                                                         |
| `set: { id: … }` or rename a field                                                    | `id cannot be modified; use remove + add instead`                       | remove + add, update refs                                                 |
| `remove` an endpoint/message a to-be step still uses                                  | `… refers to …, which changes[i].ops[j] removes`                        | switch the callers first (recipe 11)                                      |
| Model a consumer reading another team's table                                         | invariant 6 access error                                                | a projection record in the consumer's store, written by its consumer step |
| One change spanning four teams                                                        | one owner can't ship it; the team cut is noisy                          | one change per owning team (pattern 12)                                   |
| Number step ids or change ids                                                         | ids stop meaning anything after an insert                               | verb slugs: `#log-skipped`, `chg:billing-skip-paused`                     |
| Author status, colour, seq, before-values, counts                                     | unknown property errors                                                 | nothing: they're derived                                                  |

---

## 15. Screens: a new look, a new region, a new screen

Today, in the model (`contracts.yaml` of the system that serves it): the screen with the regions the plan will talk about.

```yaml
screens:
  - id: scr:checkout
    name: Checkout
    service: svc:web # the ui service
    kind: page # page | modal | sheet | email | push | print
    route: /checkout
    device: mobile # desktop | mobile | handheld | any
    summary: 'Slot, lines and the Place order button.'
    image: assets/checkout.svg # today's screenshot under workspaces/<ws>/assets/
    regions:
      - {
          id: scr:checkout#lines,
          name: Lines,
          shows: 'Each line with a checkbox.',
          reads: ['sch:order-line#allow_substitutes'],
          at: { x: 4, y: 18, w: 92, h: 40 },
        }
      - {
          id: scr:checkout#place-order,
          name: Place order,
          shows: 'The button.',
          at: { x: 4, y: 90, w: 92, h: 7 },
        }
    sources: [{ url: 'https://github.com/org/web/blob/<sha>/src/pages/Checkout.tsx#L1-L80' }]
```

A step says where it happens (the screen's service must be `from` or `to`):

```yaml
- {
    id: flow:place-order#submit,
    from: svc:web,
    to: svc:bff,
    via: api:bff-place-order,
    action: 'Submit the basket',
    screen: scr:checkout#place-order,
  }
```

The change sets the new look and the regions:

```yaml
- modify: scr:checkout
  set:
    image: assets/checkout-tobe.svg # wireframe or design export
    figma: 'https://www.figma.com/design/…?node-id=12-440'
    mockup: mockups/walking.html # the app opens it at #scr:checkout
- modify: 'scr:checkout#lines'
  set: { shows: 'Each line, no checkbox.', at: { x: 4, y: 18, w: 92, h: 33 } }
  drop: { reads: ['sch:order-line#allow_substitutes'] }
- add: region
  into: scr:checkout
  value:
    {
      id: scr:checkout#substitution-default,
      name: 'If something is out of stock',
      shows: 'One choice for the order.',
      reads: ['sch:order#substitution_default'],
      at: { x: 4, y: 53, w: 92, h: 16 },
    }
- remove: 'scr:checkout#old-banner'
```

A new screen (a sheet, a push, an email) is `add: screen` with its regions inside the value; put
`screen:` on the added steps that show it. A screen that only exists to-be has no `image` warning,
but give it a wireframe anyway: it is what the room reviews.

---

## 16. Graph: add a subgraph and a field that needs another field

```yaml
- add: subgraph
  value:
    {
      id: sg:promise,
      name: Promise subgraph,
      graph: graph:storefront,
      service: svc:promise-graph,
      batching: dataloader,
      cache_control_default: 0,
      timeout_ms: 600,
    }
- add: field
  into: sch:gql-product
  value:
    {
      name: deliveryPromise,
      type: 'DeliveryPromise',
      subgraphs: [sg:promise],
      requires: ['sch:gql-stock#fc'],
      reads: [sch:delivery-promise#promised_date],
      cache: [{ at: st:promise-redis, ttl: 60 }],
      cache_control: { max_age: 60 },
    }
- modify: sch:gql-product
  set: # the promise subgraph must be askable for a Product by sku: add it to that key's `in`
    keys:
      [
        { fields: [sku], in: [sg:product, sg:pricing, sg:inventory, sg:promise] },
        { fields: [id], in: [sg:product, sg:reviews] },
      ]
```

The subgraph must appear in a key's `in` (the validator errors otherwise). `requires` makes the gateway
fetch `stock.fc` first; the plan shows it greyed in the document and one more round trip.

## 17. Graph: move a field with `override` (expand, migrate, remove)

```yaml
# expand: the new subgraph serves it next to the old one, 0 % of traffic
- modify: 'sch:gql-product#price'
  append: { subgraphs: [sg:pricing-v2] }
  set: { override: { from: sg:pricing, percent: 0 } }
# migrate: raise the percent in later changes (10, 50, 100)
- modify: 'sch:gql-product#price'
  set: { override: { from: sg:pricing, percent: 10 } }
# remove: drop the old owner and the override
- modify: 'sch:gql-product#price'
  drop: { subgraphs: [sg:pricing] }
  set: { override: null }
```

One change per rung, each with its work item and test; 5.4 draws the ladder.

## 18. Graph: split an operation, change a cache TTL with a reason

```yaml
- add: operation
  value: { id: gql:product-promise, name: ProductPromise, kind: query, graph: graph:storefront, screens: [scr:pdp#delivery], trigger: load, method: GET, persisted: apq,
           document: "query ProductPromise($sku: ID!, $region: Region!) { product(sku: $sku) { sku deliveryPromise(region: $region) { date } } }",
           cache: [{ at: st:edge-cache, ttl: 60, key: { operation: id, variables: [sku, region] }, reason: "promise moves in minutes; region is part of the key, not private" }] }
- modify: gql:product-page
  set: { document: | … }     # the whole new document; 5.x shows the lines added and removed
- modify: gql:product-page
  set: { cache: [{ at: st:edge-cache, ttl: 60, reason: "…why 60 s is right now…" }] }   # the ledger prints "edge cache 600 s → 60 s"
```

An override above the derived max-age (the shortest `cache_control.max_age` of the selected fields) warns
unless the reason says why.

## 19. Graph: a purge step

```yaml
- add: step
  into: flow:promise-change-purge
  value:
    {
      id: flow:promise-change-purge#purge-edge,
      from: svc:cache-purger,
      to: svc:fastly,
      via: api:fastly-purge,
      action: 'Purge the surrogate key',
      purges: [st:edge-cache],
    }
```

The cache is then "emptied by" the event that precedes the step in that flow; `invalidated_by` on the store is
only a shortcut and warns when no step purges it. The acting service must own the cache or have `access`. When the step calls the owner's purge endpoint (`via: api:…`, `to` the owner), the caller (`from`) is the acting service, so the purger needs `access: [{ svc: svc:cache-purger, mode: write }]` on the cache.

---

## 20. Handlers: add a step, a branch, or a new handler

Today's handlers live in the model (`handlers.yaml`); a plan changes them with ordinary ops on `h:` ids. Steps
have no ids, so a change either appends to the end of a step list or replaces the tree.

```yaml
# Append steps at the end of what runs
- modify: h:billing-run-invoice
  append:
    steps:
      - publish: msg:invoice-charged
        when: the charge succeeded
        does: Tells entitlements the subscription is paid

# Reshape the logic: set the whole tree. Before and after are derived, so write only the after.
- modify: h:billing-run-invoice
  set:
    steps:
      - read: sch:subscription
        from: st:billing-db
      - if: the subscription is paused
        then:
          - write: 'sch:invoice#skip_reason'
            to: st:billing-db
          - return: skipped
      - call: api:psp-charge
      - publish: msg:invoice-charged
  append:
    fails:
      - { when: the PSP declines, result: invoice marked failed; retried next run }

# A new endpoint or consumer gets its handler in the same change
- add: endpoint
  into: if:subs-rest
  value: { id: api:subs-pause, sig: 'POST /subscriptions/{id}/pause', response: sch:subscription }
- add: handler
  value:
    id: h:subs-pause
    on: api:subs-pause
    component: svc:subscriptions
    summary: Pauses a subscription until a date.
    steps:
      - write: 'sch:subscription#status'
        to: st:subs-db
      - publish: msg:subscription-status-changed
      - return: sch:subscription

# A handler goes when its trigger goes
- remove: h:subs-legacy-cancel
```

Keep the plain-words rules of [handlers.md](../groundwork-explore/handlers.md): conditions a product person
would say, every outgoing call and decision kept, trivial code collapsed. A new call between components is a
`call` step in the caller's handler; the connection and the call tree are derived from it.
