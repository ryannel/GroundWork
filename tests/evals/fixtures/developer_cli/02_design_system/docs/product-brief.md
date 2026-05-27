# Product Brief: Forge CLI

## System Purpose

Forge is a CLI tool that scaffolds and manages microservice projects. A developer runs `forge new service --lang go --auth clerk` and gets a fully structured, runnable service directory in under 10 seconds — with the right folder layout, Dockerfile, CI config, and wiring to the shared infrastructure. Forge also handles day-2 operations: adding messaging, rotating auth patterns, and keeping service boilerplate up to date as the team's standards evolve.

## The Problem

Every time a team starts a new microservice, someone copies an old service as a starting point. That copy carries stale patterns, wrong port numbers, and six months of "temporary" workarounds. New engineers spend their first week wrestling with setup instead of shipping. When the team upgrades a shared pattern (e.g., migrating from service tokens to mTLS), propagating the change to 12 services is a manual, error-prone weekend project.

## Target Users

**Backend Engineer**
- Who: Engineers spinning up new services and maintaining existing ones.
- Job: Get a new service running and wired into the infrastructure without knowing every pattern by heart.
- Success: `forge new service` produces something that boots, passes lint, and deploys in CI on the first try.

**Tech Lead / Platform Engineer**
- Who: The person who maintains the scaffold templates and enforces standards across the team.
- Job: Define what a "correct" service looks like, publish it as a Forge template, and push updates to all services when standards change.
- Success: Template update propagates to all services with `forge update` — no manual copy-paste.

## Capabilities

**Service Scaffolding**
Generate a new service directory from a template. Flags configure language (`--lang go|python|typescript`), auth pattern (`--auth none|service|clerk`), messaging (`--messaging gcp-pubsub`), and optional features (`--websockets`, `--llm`). Output: a directory the developer can `cd` into and run immediately.

**Template Registry**
Templates are versioned and stored in a registry (initially local to the repo, later publishable). `forge template list` shows available templates and their versions.

**Service Update**
Apply template changes to an existing service. Forge diffs the current service against the latest template, shows a preview of changes, and applies with developer confirmation. `forge update service <name>`.

**Workspace Awareness**
Forge understands the Nx workspace layout. Running `forge new service` in the workspace root registers the service in `nx.json` and updates `docker-compose.yml`. Running it in an unrecognised directory warns before proceeding.

**Dry Run**
All mutating commands support `--dry-run`: show exactly what would change without writing files.

## Constraints

- Must work on macOS and Linux. Windows is not a target.
- `forge new service` must complete in under 10 seconds on a standard developer laptop.
- Generated services must pass the project's lint and test suite without modification.
- Templates must be independently testable (the scaffold CI runs `forge new service` for each template and verifies the output builds).

## Success Signal

A new engineer joins the team, runs `forge new service` on their first day, and ships their first PR for that service within their first week — without asking the tech lead how to set up service boilerplate.
