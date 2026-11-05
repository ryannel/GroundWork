# User requirements for the consolidated design

1. One way to do each thing, one place to look. Simplify and consolidate; big re-orgs are fine (POC).
2. Reduce repository size without losing information.
3. Keep the actual detail: which systems call what, and under which conditions. From an API endpoint you can see
   a high-level view of the logic under it, what it depends on, and when and by whom it gets called.
4. Two layers: a high-level "which systems talk to which" view, authored by an LLM to simplify, and under it
   always the full detail. Summary edges must be traceable down to the detailed calls and evidence beneath them.
5. Upcoming views: pick a single endpoint and see the detailed process flow underneath it, including the API
   request/response schema, storage schemas (tables/collections/fields) and message schemas for topics/queues.
6. The same for message handling: from a received message (topic/queue subscription), explore what happens
   next — the steps, conditions, writes, calls and messages it emits — with schemas.
   Entry points are therefore at least: HTTP/gRPC/GraphQL endpoints, message consumers (and probably schedules).
