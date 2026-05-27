# Project Architecture: StoreLens Analytics

## 1. Technical Constraints

- **Security and trust model:** Clerk for user authentication. Multi-tenant — each organisation's data is isolated at the database row level using a `tenant_id` column with row-level security.
- **Scale:** Up to 500,000 orders/day per tenant. Up to 20 storefronts per tenant. Design for read-heavy workloads (dashboard refreshes every 60s per active user).
- **Availability:** Sub-2-second dashboard load. ≤90 second data freshness from source systems.
- **Geographic distribution:** Single-region deployment initially (US-East). CDN for static assets.
- **Existing constraints:** GCP as cloud provider. Clerk for auth. Initial integrations: Shopify and ShipBob webhooks.

## 2. Domain Topology

Three services:

- **Dashboard App (Next.js):** User-facing frontend. Handles Clerk authentication, renders the operations dashboard, and calls the Analytics API.
- **Analytics Service (Go):** Owns the operational data model — orders, inventory, fulfilment events, exceptions. Exposes a REST API consumed by the Dashboard App. Applies tenant isolation at the query layer.
- **Ingestion Worker (Go):** Processes incoming webhook events from Shopify and ShipBob. Normalises and writes operational data to the shared database. Decoupled from the Analytics Service via the database (not via messaging).

**Rationale:** Separating ingestion from the query path means a spike in incoming webhooks does not degrade dashboard response times. The Analytics Service is read-optimised; the Ingestion Worker is write-optimised.

## 3. Capability Decisions

- **Data Persistence:** PostgreSQL with row-level security. Tenant isolation via `tenant_id` on all operational tables. Read replicas for dashboard queries. No separate analytics warehouse in MVP.
- **Caching:** Redis for short-lived dashboard caches (TTL: 30s). Prevents thundering-herd on simultaneous dashboard refreshes by a large tenant's team.
- **Authentication:** Clerk. Dashboard App enforces Clerk middleware. Analytics Service validates service-to-service tokens for internal calls from Dashboard App's server components.
- **Real-time updates:** Server-Sent Events from the Analytics Service to the Dashboard App. The Dashboard App holds SSE connections and pushes updates to connected browser clients via WebSocket or polling.
- **Alerting:** Threshold evaluation runs as a scheduled job inside the Analytics Service (every 60s). Alert delivery (Slack webhook) handled by a background goroutine within the same service. No separate notification service in MVP.

## 4. Component Boundaries

**Dashboard App (Next.js):**
- Owns: User-facing UI, Clerk auth flow, SSE connection management.
- Does Not Own: Operational data, alert configuration logic.
- Contracts: `GET /api/dashboard`, `GET /api/inventory`, `GET /api/exceptions`, `GET /api/events` (SSE). Health: `GET /api/healthz`.

**Analytics Service (Go):**
- Owns: Operational data model, tenant isolation, alert threshold evaluation.
- Does Not Own: Webhook ingestion, user identity (delegated to Clerk).
- Contracts: REST API (OpenAPI), SSE endpoint. Health: `GET /health`.

**Ingestion Worker (Go):**
- Owns: Webhook receipt, payload normalisation, idempotent write to the database.
- Does Not Own: Dashboard queries, alert logic.
- Contracts: `POST /webhooks/shopify`, `POST /webhooks/shipbob`. Health: `GET /health`.

## 5. Service Table

| Service | Generator | Language | Port | Health |
|---|---|---|---|---|
| `dashboard-app` | `nextjs-app` | TypeScript | 3000 | GET /api/healthz |
| `analytics-service` | `go-microservice` | Go | 8080 | GET /health |
| `ingestion-worker` | `go-microservice` | Go | 8081 | GET /health |
