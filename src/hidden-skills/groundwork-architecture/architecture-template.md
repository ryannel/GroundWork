# Architecture Foundation

This document defines the physical and logical boundaries of the system required to deliver the MVP.

## 1. Constraints & Budgets

## 2. Top-Level Topology

## 3. Key Capabilities & Technical Decisions

### Capability Ports & Providers

Each technical capability the system depends on — LLM inference, a relational or vector store, messaging, telemetry, object storage, email, payments — is a hexagonal **port** satisfied by exactly one chosen **provider**. Record the port, the provider, and the provider's **operational footprint** (exactly one of `env` · `compose-service` · `runner` · `none`), with a one-line rationale. `none` is a first-class choice: a **raw gateway** — the port plus a failing contract test, no adapter — to be built later as a bet. There are no default providers; infrastructure (a database, a tracing backend) appears *because* a provider's footprint requires it, never as a guess.

> Distinct from the **capability ledger** in `docs/surfaces.md`, which tracks user-facing *features* across surfaces. This table is about *technical ports* and the adapters that satisfy them.

| Capability (port) | Provider | Footprint | Rationale |
|---|---|---|---|

## 4. Component Boundaries & Contracts

## 5. Communication & Integration Patterns

## 6. Service-Level Requirements

| Requirement | Originates From | Applies To |
|---|---|---|

## 7. Surfaces & Capability Core
