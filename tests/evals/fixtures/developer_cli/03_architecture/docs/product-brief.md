# Product Brief: Forge CLI

## System Purpose

Forge is a CLI tool that scaffolds and manages microservice projects. A developer runs `forge service new --lang go --auth clerk` and gets a fully structured, runnable service directory in under 10 seconds. Forge handles day-2 operations: adding capabilities, updating shared boilerplate, and keeping services aligned with the team's evolving standards.

## Target Users

**Backend Engineer** — Spins up new services and maintains existing ones. Needs `forge service new` to produce something that boots and passes CI on the first try.

**Tech Lead / Platform Engineer** — Maintains scaffold templates. Needs `forge service update` to propagate template changes across all services without manual copy-paste.

## Capabilities

- `forge service new` — Generate a new service from template with flags for language, auth, messaging, and optional features
- `forge service update` — Apply template changes to an existing service, with diff preview and confirmation
- `forge template list` — Show available templates and versions
- `forge workspace status` — Validate workspace structure and detect drift
- `--dry-run` on all mutating commands
- Workspace awareness: auto-registers new services in `nx.json` and `docker-compose.yml`

## Constraints

- macOS and Linux only. Under 10s for service generation. Generated services must pass lint and CI without modification. Templates must be independently testable.
