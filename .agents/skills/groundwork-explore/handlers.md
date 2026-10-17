# Handlers: what runs when something arrives

A handler is the code that runs when something arrives at a component: a request on an endpoint, a message on a
topic, a schedule firing, or a person acting on a screen. Groundwork keeps each one as a short **step tree** so a
newcomer can read what happens, in order, without opening the code, and so a plan can say "add this step" or
"add this branch" against a stable id.

Write one handler for every business endpoint, message consumer, scheduled job and UI action in the repo. They
go in the fragment's `handlers:` list; the merge writes them to the system's `handlers.yaml`.

## Shape

```yaml
- id: h:pricing-get-price
  on: api:pricing-get-price # api:<endpoint id> | msg:<message id> | ui:<interaction id> | "job:<cron or name>"
  component: svc:pricing
  origin: extracted
  summary: Answers the price of one item in one market, from the cache when it can.
  sources:
    [
      {
        repo: acme/pricing,
        path: src/main/kotlin/pricing/PriceRoutes.kt,
        lines: [40, 88],
        commit: 3f9c…,
        symbol: getPrice,
      },
    ]
  steps:
    - read: sch:price-rule
      from: st:pricing-db
      sources:
        [
          {
            repo: acme/pricing,
            path: src/main/kotlin/pricing/PriceRepo.kt,
            lines: [12, 30],
            commit: 3f9c…,
          },
        ]
    - if: no list price for the market
      then:
        - return: 404 not_found
    - if: a promotion applies today
      then:
        - does: Takes the lower of list and promotion price
      sources:
        [
          {
            repo: acme/pricing,
            path: src/main/kotlin/pricing/PriceRoutes.kt,
            lines: [61, 70],
            commit: 3f9c…,
          },
        ]
    - call: api:fx-get-rate
      when: the market's currency is not the list currency
      sources:
        [
          {
            repo: acme/pricing,
            path: src/main/kotlin/pricing/FxClient.kt,
            lines: [22, 35],
            commit: 3f9c…,
          },
        ]
    - return: sch:price
  fails:
    - when: the FX service does not answer within 2 s
      result: 503 fx_unavailable
      sources:
        [
          {
            repo: acme/pricing,
            path: src/main/kotlin/pricing/FxClient.kt,
            lines: [36, 44],
            commit: 3f9c…,
          },
        ]
```

`id`, `on`, `component` and `steps` are required. Each step is exactly one of these kinds, and every kind also
takes `does` (plain words), `when` (a guard: the step runs only when this holds), `async: true` (the handler does
not wait for it), `sources` and `origin`:

| Step       | Means                                | Keys                                                           |
| ---------- | ------------------------------------ | -------------------------------------------------------------- |
| `does`     | work done in place                   | `does`                                                         |
| `call`     | calls an endpoint and waits          | `call: api:…`                                                  |
| `publish`  | publishes a message                  | `publish: msg:…`                                               |
| `read`     | reads a record or field from a store | `read: sch:…[#field]`, `from: st:…`                            |
| `write`    | writes a record or field to a store  | `write: sch:…[#field]`, `to: st:…`                             |
| `if`       | a business decision                  | `if: <condition in plain words>`, `then: [...]`, `else: [...]` |
| `each`     | a loop                               | `each: <what is iterated, in plain words>`, `do: [...]`        |
| `parallel` | branches that run at once            | `parallel: [[...], [...]]`                                     |
| `retry`    | retried work                         | `retry: <what or on what>`, `times`, `do: [...]`               |
| `try`      | work with a fallback                 | `try: [...]`, `catch: [...]`                                   |
| `return`   | what the caller gets                 | `return: sch:… or plain words`                                 |
| `wait`     | a timer or schedule                  | `wait: <how long, or until when>`                              |

`fails` lists what the caller sees when it goes wrong: `when` in plain words, `result` as the caller gets it
(`404 not_found`, "message goes to the dead-letter topic", "job stops; next run retries").

## The level a newcomer needs

Read the handler body and whatever it calls inside the same component, then write the tree at the level of
decisions and effects, not statements.

**Keep, always:**

- every outgoing call to another component (HTTP, gRPC, GraphQL, SDK), as `call`;
- every publish, as `publish`, including an outbox write that a relay publishes later (`write` to the outbox,
  then a `does` that says the relay publishes it, or `publish` with `async: true`);
- every read from and write to a store the component owns or shares, as `read` or `write`, with the field when
  only one field changes (`sch:order#status`);
- every business decision, as `if` with the condition in words a product person would use: "the basket is over
  the free-delivery threshold", not `if (total > cfg.fdt)`;
- every loop over business things, as `each`: "each line in the basket";
- concurrency (`parallel`), retries with their count, fallbacks (`try`/`catch`) and timers (`wait`);
- what is returned and every way it fails.

**Collapse:**

- validation, mapping, logging, metrics, tracing and null checks into one `does` or nothing at all; keep a
  validation only when its failure is something the caller sees (then it is a `fails` entry);
- helper functions into the steps they contain: follow the call, do not cite the helper as a step;
- framework plumbing (dependency injection, middleware, serialisation) entirely, unless it makes a business
  decision such as an auth rule specific to this endpoint;
- a chain of trivial steps into one `does` sentence.

A handler is usually 3 to 15 steps. Past about 25, the handler is doing several jobs: say so in `summary` and
consider whether it is really two (a sync part and an async part, say).

**Sources:** the handler cites the whole function. Each **significant** step cites the lines that make it
happen: every `call`, `publish`, `read`, `write`, `if`, `each`, `retry` and `try`, and every `fails` entry. A
`does` that collapses trivial code may go without. `tools/sources.ts --missing` lists significant steps without
sources; the scan report counts them.

## Finding them

| Starts on | Look for                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| endpoint  | route tables and annotations: Ktor `routing { get(…) }`, Spring `@GetMapping`, Express or Fastify `app.get`, Next.js `route.ts`, FastAPI `@app.get`, Go `mux.HandleFunc`, gRPC service implementations, GraphQL resolvers |
| message   | `@KafkaListener`, `consumer.subscribe`, `@RabbitListener`, SQS or Pub/Sub subscriptions, `onMessage`, outbox relays                                                                                                       |
| job       | cron in Helm, k8s `CronJob`, `@Scheduled`, `node-cron`, Celery beat, GitHub Actions `schedule`, serverless `schedule` events                                                                                              |
| UI action | event handlers (`onClick`, `onSubmit`, form actions, server actions), and the requests they make                                                                                                                          |

To find what a step talks to:

- **outgoing calls**: HTTP and gRPC clients, generated SDKs, and the environment variable or config key that holds
  the base URL. Match the method and path to an endpoint id from the ids table.
- **publishes**: producer `send`/`publish` calls and the topic constant; match topic and event to a message id.
- **stores**: repositories, DAOs, ORM calls, raw SQL, cache clients; match the table or key to a schema and its
  store.

## Calls you cannot resolve

When the target is another system and the ids table has no endpoint that matches, write the call with what you
know and let the orchestrator resolve it:

```yaml
- call: '?'
  target: POST https://fx.internal/rates/{currency} # method and URL or the client and method you saw
  does: Fetches today's rate for the market's currency
  sources: [...]
```

This form is for fragments only; `call: "?"` does not validate. The merge either matches `target` to an endpoint
in another system's `contracts.yaml` or rewrites the step as a `does` plus a question to the owning team.

## Re-scans

When the work list names a handler to re-explore, read it again from the top and write the whole tree; the merge
replaces the old one. Keep its id even if the function was renamed: the id follows `on`, not the code. A handler
whose trigger is gone (the route or the listener was removed) goes in `vanished`.

## Handlers and flows

Flows (`flows/*.yaml`) are curated walks across components; handlers are what the code does at one component.
They should agree: a flow step from `svc:checkout` to `svc:wms` via `api:wms-release` should match a `call:
api:wms-release` somewhere in a checkout handler. You do not edit flows; the scan report lists the ones that no
longer match.
