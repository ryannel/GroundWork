# Runtime catalog taxonomy

Classify each fact across independent dimensions.

## Direction

- `inbound`: calls, events, or messages received by the selected component.
- `outbound`: calls, events, or messages initiated by the selected component.

Direction applies to a relation, not to a component globally.

## Role

### Business service

A deployable capability that performs domain work. Internal services and vendor-hosted
business APIs can both have this role.

### Platform service

An operational capability consumed by application code: feature flags, identity,
observability, secrets, configuration control planes, or service discovery.

### External provider

A partner or vendor capability that participates directly in the business flow, such as
payments, insurance, shipping, credit, or vehicle data.

## Ownership

- `internal`: owned or operated inside the organization.
- `external`: operated outside the organization.

Ownership does not determine role. LaunchDarkly is external ownership with platform role.
An internally hosted identity service is internal ownership with platform role.

## Infrastructure

- `database`: durable structured storage.
- `cache`: Redis or another cache/key-value store, whether used as cache or document store.
- `object-storage`: blobs or documents in object storage.
- `local-storage`: process-local or filesystem persistence.
- `queue`: queue, topic, stream, broker, or event channel.

Record the actual usage semantics. A Redis deployment used as the system of record still
needs its observed data-at-rest shape even when its component kind remains `cache`.

## Data surfaces

- `request` and `response`: synchronous API data.
- `message`: asynchronous event or command payload.
- `record`: SQL row, document, object, or durable aggregate.
- `keyspace`: naming and value pattern for key-value stores.

## Presentation

Use role and data semantics as primary groups. Render ownership, transport, and technology
as badges. Do not create separate empty panels for every combination.

