# Project Architecture: Forge CLI

## 1. Technical Constraints

- **Distribution:** Single static binary, no runtime dependencies. Cross-compiled for macOS (arm64, amd64) and Linux (amd64). Distributed via `curl | sh` installer and Homebrew tap.
- **Performance:** `forge service new` must complete in under 10 seconds on a standard developer laptop with no network access (all templates are embedded in the binary in MVP).
- **Correctness:** Generated services must pass the project's lint and test suite without modification. Template changes must not break existing services.
- **No persistent infrastructure:** The Forge CLI itself has no server component, database, or daemon process. It is a pure local tool in MVP.

## 2. Domain Topology

Single service (the CLI binary itself). No runtime services. All logic executes locally within the CLI process.

Internal modules:
- **Template Engine:** Reads embedded templates (Go embed), applies variable substitution, writes output to the filesystem.
- **Workspace Manager:** Reads and writes `nx.json`, `docker-compose.yml`, and the Forge workspace manifest (`.forge/workspace.json`).
- **Differ:** Computes diffs between current service files and the latest template, presents a human-readable preview.
- **CLI Layer:** Cobra-based command routing, flag parsing, output formatting.

**Rationale:** A CLI tool that scaffolds other services has no need for a persistent server in MVP. The template registry starts embedded in the binary (versioned with the binary) and migrates to a remote OCI registry once the team wants to decouple template versioning from CLI releases.

## 3. Capability Decisions

- **Template storage (MVP):** Embedded in the binary using Go `embed`. Templates are versioned alongside the CLI binary. No network required for `forge service new`.
- **Template format:** Go `text/template` for file content templating. A `template.json` manifest describes the template's variables, supported flags, and output structure.
- **Workspace manifest:** `.forge/workspace.json` tracks registered services, their template versions, and applied flags. Used by `forge service update` to detect drift.
- **Diff engine:** Myers diff algorithm. Output format mirrors `git diff` for familiarity. Applied atomically per file — partial file writes are not possible.
- **Output formatting:** ANSI colour codes when stdout is a TTY. Stripped when piped or when `NO_COLOR` / `--no-color` is set. `--json` outputs structured JSON to stdout for scripting.

## 4. Component Boundaries

Forge is a single binary. No inter-service contracts. External dependencies:
- **Filesystem:** reads `.forge/workspace.json`, `nx.json`, `docker-compose.yml`; writes scaffolded service files and updates workspace files.
- **Git (optional):** reads `.git/` to detect the workspace root. Does not run git commands — developers manage git themselves.
- **Remote registry (post-MVP):** OCI registry or GitHub releases for template distribution.

## 5. Service Table

Forge CLI has no runtime services. The scaffold phase will generate the services defined in each project using Forge — Forge itself does not produce a `docker-compose.yml` for its own operation.

For the purpose of the scaffold eval, use a single Go CLI service:

| Service | Generator | Language | Port | Health |
|---|---|---|---|---|
| `forge-cli` | `go-microservice` | Go | 8080 | GET /health |

Note: The `go-microservice` generator produces the correct Go project structure. The CLI-specific adjustments (Cobra, embed, binary build) are applied on top of the generated scaffold.
