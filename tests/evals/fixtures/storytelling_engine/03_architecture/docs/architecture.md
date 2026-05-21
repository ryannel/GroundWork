# Project Architecture

## 1. Introduction

This document outlines the high-level architecture for the project, detailing the technical constraints, domain topology, capability decisions, and component boundaries.

## 2. Technical Constraints

- **Content and regulatory:** User-generated stories, global operation, no sensitive data requiring regulated handling.
- **Security and trust model:** Clerk for user authentication. Multi-tenant — each user's stories are private and isolated.
- **Scale and infrastructure model:** Expecting millions of users eventually, starting small. Scale-to-zero preferred initially for cost control.
- **Availability and reliability:** Downtime should be infrequent. Up to one hour of new story data loss is tolerable in a failure scenario.
- **Geographic distribution:** Global user base; latency should be minimised for a good authoring experience.
- **Existing technology and vendor constraints:** GCP as the cloud provider. Clerk for auth. No legacy system constraints.
- **Performance:** Story loading and saving must feel near-instantaneous (under 1 second for reads; under 2 seconds for writes).

## 3. Domain Topology

The system is divided into three services:

- **Auth Gateway (Next.js):** The user-facing frontend. Handles Clerk authentication and proxies API requests to the Story Service.
- **Story Service (Go):** Owns the full lifecycle of stories — creation, editing, deletion, retrieval, and access control enforcement.
- **Narrative Engine (Python):** Handles AI-driven narrative generation. Consumes story creation events, calls an LLM, and publishes generated content back.

**Rationale:** The frontend is separated from backend services to allow independent deployment and to keep Clerk credential handling at the edge. Story lifecycle and AI generation are separated because they have incompatible scaling profiles — the Story Service is latency-sensitive and stateful; the Narrative Engine is throughput-sensitive and stateless. Separating them allows the Narrative Engine to scale to zero between generation bursts.

## 4. Capability Decisions

- **Data Persistence:** PostgreSQL. The story domain is relational — users own stories, stories have versions, access control is set-based. PostgreSQL's ACID guarantees and JSONB support handle structured story metadata alongside flexible narrative content without requiring a separate document store.

- **Async Messaging:** GCP Pub/Sub. Story creation triggers narrative generation asynchronously. Pub/Sub provides durable, at-least-once delivery with consumer groups — the Narrative Engine processes creation events independently of the Story Service request cycle. Selected over Kafka for lower operational overhead at the expected scale.

- **Authentication:** Clerk. Handles Google and Apple sign-in. The Auth Gateway (Next.js) enforces Clerk middleware at the edge. The Story Service validates service-to-service tokens for internal calls. The Narrative Engine uses service-to-service auth only — it never handles user tokens directly.

- **LLM Integration:** The Narrative Engine includes an abstract LLM gateway. The provider is not locked in at the architecture level — the gateway pattern allows swapping between OpenAI, Anthropic, and GCP Vertex without changing the service interface.

**Downstream Obligations:**

- **Auth Gateway:** Must proxy authenticated API requests to the Story Service. Clerk middleware runs on all non-public routes.
- **Story Service:** Must publish `StoryCreateRequested` events to GCP Pub/Sub on story creation. Must implement the transactional outbox pattern to guarantee event delivery even if Pub/Sub is transiently unavailable.
- **Narrative Engine:** Must implement idempotent event handlers — Pub/Sub delivers at least once, so duplicate processing is expected.

## 5. Component Boundaries & Contracts

**Auth Gateway (Next.js):**

- **Owns:** User-facing frontend, Clerk authentication flow, API proxy to Story Service.
- **Does Not Own:** Story data, narrative content, AI generation.
- **Contracts:**
  - Clerk middleware on all authenticated routes.
  - Server-side reverse proxy: `GET|POST|PUT|DELETE /api/*` → Story Service.
  - Health check: `GET /api/healthz`.

**Story Service (Go):**

- **Owns:** Complete story lifecycle — creation, editing, deletion, retrieval. Access control enforcement. Event publishing.
- **Does Not Own:** User authentication (delegated to Clerk via the Auth Gateway), narrative generation.
- **Contracts:**
  - REST API (OpenAPI): `GET /stories/{id}`, `POST /stories`, `PUT /stories/{id}`, `DELETE /stories/{id}`.
  - Health check: `GET /health` returning `{"status": "ok", "db": "connected"}`.
  - Pub/Sub publisher: `StoryCreateRequested` event on story creation.
- **Trust Boundary:** Validates Clerk JWTs on all user-facing routes. Validates service tokens on internal routes.

**Narrative Engine (Python):**

- **Owns:** AI narrative generation — consuming story creation events, calling the LLM gateway, and publishing generated narrative content.
- **Does Not Own:** Story persistence, user authentication, event routing.
- **Contracts:**
  - Pub/Sub subscriber: `StoryCreateRequested` event.
  - Pub/Sub publisher: `NarrativeGenerated` event on successful generation.
  - Health check: `GET /health`.
- **Trust Boundary:** Accepts service-to-service tokens only. Never handles user tokens.
