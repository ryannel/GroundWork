# Planning with Groundwork

Groundwork plans live in this repository under `.groundwork/plans/`. Commit them with the implementation. The package supplies the viewer, CLI and MCP server. Plans remain readable and editable while Groundwork is stopped.

Run the installed CLI with `npx --no-install groundwork-v2`. Node 22.18 or newer is required. Do not install the older `groundwork-method` package.

Planning and delivery updates are agent-managed through conversation. Use the CLI/MCP operations to create features, maintain deliverables and tasks, record progress, and attach validation evidence. The viewer is read-only: it displays these records without authoring forms or status controls. Search, filters, navigation, and prototype interactions only affect the view.

## Start here

- `npm run plans:start` (or `npx --no-install groundwork-v2 start`) starts or reuses Groundwork Hub on port 4318 and prints this project's workspace URL. It registers the project locally if needed and preserves existing workspace grouping.
- `npm run plans:standalone` (or `npx --no-install groundwork-v2 serve`) starts or reuses a standalone viewer on port 4317. It does not require a Hub or register the project.
- `npm run plans:hub` (or `npx --no-install groundwork-v2 hub`) starts or reuses the Hub and prints its All projects URL. `dashboard` remains an alias.
- `init` and `instructions` add these `plans:*` scripts when a package.json exists, without replacing existing scripts. Without an npm project, invoke the installed CLI directly.
- The terminal that starts a server must stay open. Ctrl+C stops that server; stopping a Hub disconnects all of its project workspaces. A command that reuses a server prints the URL and exits. No background daemons or per-project app servers are launched.
- Use `--port NUMBER` consistently for a different local port. Commands refuse to reuse a different project, configuration, unrelated service, or incompatible viewer on that port; they never silently allocate another server.
- `npx --no-install groundwork-v2 read` returns the complete plan, current revision, checkout identity and Git activity.
- `npx --no-install groundwork-v2 validate` checks documents and cross-references.
- `npx --no-install groundwork-v2 register --workspace Personal` adds this checkout to the local central dashboard.
- The optional Hub serves all registered projects through one server. Plans and assets remain in each repository; opening a workspace does not launch its application.
- `npx --no-install groundwork-v2 mcp` exposes the same operations to your coding agent over stdio. Configure your MCP client to run `npx` with arguments `["--no-install", "groundwork-v2", "mcp", "/absolute/repository/path"]`. Add `--central` instead of the path for discovery across registered repositories.

## Portable files

`project.json` contains schemaVersion 2, an immutable project ID, a name, and an optional domain URL. A repository contains one project and can have multiple products. `products/<id>.json`, `components/<id>.json` and `members/<id>.json` describe its structure and collaborators. IDs must match filenames. Products have no workspace membership field.

Each `features/<id>/` directory contains `feature.json`, an optional `brief.md`, and optional `journey.json`, `design.json`, `flow.json`, `api.json`, `storage.json`, `tests.json` and `delivery.json`. Schemas are installed under `.groundwork/schemas/`; portable project and product schemas are named `portable-project` and `portable-product`. Do not use the legacy project/product schemas for new repositories.

Feature briefs use Markdown with `## Problem`, `## Outcome`, `## Non-goals` and `## Success criteria` headings. Problem and outcome are paragraphs. Non-goals are bullets. Success criteria are bullets with stable IDs, for example:

```markdown
# Feature brief

## Problem

Describe the user problem.

## Outcome

Describe the intended improvement.

## Non-goals

- Something outside this feature.

## Success criteria

- [first-result] A measurable result {tests: first-test}
```

The tests suffix is optional; when present, IDs must exist in tests.json. `brief.md` is the source of truth for the viewer's purpose section. Do not create a second `purpose.json`. Decision records are plain Markdown under `decisions/<id>.md` or `features/<id>/decisions/<id>.md`.

Raster images go under `assets/`, with a relative reference such as `assets/screens/recording.png`. Names use letters, digits, hyphens and underscores. PNG, JPEG, WebP, GIF and AVIF are supported. Repository code and executable prototypes are never loaded by the viewer. Do not put schemas or unrelated files in the plans directory.

## Explain each component's API

The API view places capability context alongside its endpoints, with expandable methods. The longer component overview and feature impact are optional reading. Add `guides` alongside `contracts` in `api.json`. Each guide has `componentId`, an `overview` explaining the component's role and key concepts, `featureImpact` describing what this feature requires from it, and `capabilities` with stable `id`, plain-language `title`, `description`, and `contractIds` linking to the relevant contracts.

Teach the concepts before the paths: for example, explain what a transcription job or live processing session represents, then link to the operations for starting and inspecting it. Distinguish target behavior from an assessed change to the existing implementation. Do not invent a current-versus-proposed comparison when the baseline has not been reviewed.

Guides describe the HTTP/RPC API provided by the component and its outgoing messages. A contract's receiver provides an HTTP/RPC API; its sender publishes a message. Caller relationships belong in system flow and supporting usage details. A browser component may have only outgoing messages in this plan; do not imply it hosts an HTTP API.

## Editing safely

Start with `read`, then retain its `revision` and `context.token`. Authoring operations require those values as `expectedRevision` and `expectedContext`. Use `call <operation> --input /path/to/request.json` with an argument file. The `write_plan` operation accepts a `changes` object mapping relative document paths to complete UTF-8 document strings, or null to delete a document. A complete candidate revision must validate before any change is applied.

The other operations are `projects`, `read_plan`, `create_feature`, `plan_delivery`, `record_progress`, `link_branch`, and `create_worktree`. Run `mcp` and request `tools/list` to discover their full JSON schemas. CLI and MCP share the same validation and transaction implementation.

Select `checkoutId` explicitly when using the central service. Re-read after a stale-write error or branch switch. Committed `ref` views are read-only. Worktree creation requires an absolute path, a new branch name, a startRef and the current revision/context; it never starts an agent. Fetch, merge, commit, push and publication remain developer actions.

Direct file editing is also supported. Validate after a coherent edit. The viewer retains the previous valid plan during malformed intermediate revisions. Coordinating concurrent agents should use the transactional tools. Groundwork serialises its own writers using a checkout-local lock. It detects conflicting external edits and refuses destructive recovery; filesystem editors do not participate in the lock.

After an interrupted tool write, run `recover`. A journal in `.groundwork/transaction.json` preserves the before and after documents. If another editor changed an affected document, recovery pauses and the journal must be reconciled manually. Never discard a recovery journal without inspecting those versions.

## Feature → Deliverables → Tasks

The delivery hierarchy is **Feature → Deliverables → Tasks**. Each task is bounded work owned by one component and verified at its public boundary. Milestones are not a separate planning entity; the term is reserved for possible future delivery checkpoints.

A feature plan must explain how the work will be delivered, alongside its brief and technical design. Use `plan_delivery` through MCP or `call plan_delivery --input request.json` through the CLI. Use `write_plan` when changing delivery and test scenarios together in one transaction.

1. Start with the smallest **deliverable** a user can experience. Describe its `outcome`, the `componentIds` that must work together, its acceptance criteria, and prerequisite deliverables. A deliverable is not a database, API, or UI phase: it brings the necessary pieces together to deliver value.
2. Divide that deliverable into **tasks**. Each task has one `componentId`, a required `deliverableId`, a short plain-language `title` and `summary`, explicit work `scope`, acceptance assertions, linked `contractIds`, and `dependsOn` links to other tasks or earlier deliverables. Use `prerequisites` for build steps such as regenerating clients after an API merges. A task may exercise a component's internal modules and infrastructure; its validation starts at the public boundary.
3. Define **validation** alongside the work. Deliverable validation has `level: "end-to-end"` and `deliverableId`. Task validation has `level: "component-integration"` and `taskId`. Use `level: "unit"` for complex isolated logic only. Link `testIds` to scenarios already defined in the feature's `tests.json`; do not duplicate those scenarios in delivery.json.
4. Every validation plan names its public `entryPoint`, test `file`, runnable `command`, and `environment`. Name `realDependencyIds` and `substitutedDependencyIds` so the test boundary is explicit. Tests should exercise real service logic and containerised infrastructure or emulators. Substitute unavoidable external providers at their outer boundary, never the component under test or its internal layers.
5. Record runs with `validationId`, result, timestamp, `testedRevision`, `environment`, and a result `reference`. A later failed or unverified report supersedes an earlier passing report. Equal-time conflicting reports are treated conservatively. Existing test status labels, commits, and agent statements alone do not establish delivery proof.

This is the honeycomb approach: most coverage comes from component integration tests through APIs, events, or the component's public interaction surface, with real internals and infrastructure. A smaller set of end-to-end tests proves the deliverable's connected user journey. Focused unit tests support difficult pure logic; they cannot replace either level of proof.

A component is an owner, not a unit of sizing: a deliverable can contain several tasks in the same component. Each task delivers one independently verifiable behavior, including the schema, logic, API, and events needed for that behavior. Split work when it has unrelated outcomes, separate failure modes, or a list of independent endpoints. Do not make tasks for whole services ("all Core endpoints") or technical layers ("all database tables"). A task should be reviewable and verifiable without waiting for later tasks in the same component.

Write a short verb-led title ("Accept a recording upload") and a one-sentence `summary` explaining what becomes possible. Keep `scope` to that behavior; put concrete assertions in `acceptance` and link the relevant contracts and test scenarios. Make dependencies specific to the capability needed, not "after Core". If a task still needs several distinct paragraphs to explain its purpose, split it again. Draft gaps are acceptable, but make them explicit rather than attaching a broad suite and claiming coverage.

For example, the upload deliverable may include Core tasks to create a meeting, accept an upload, report processing status, replace transcript segments, and save a summary. Each includes its own persistence and API/event behavior. ML tasks handle transcription and synthesis separately. App tasks cover selecting and uploading a file, showing processing progress, and reading the results. Component checks exercise each behavior at its boundary; the deliverable's end-to-end check proves the connected journey.

### Delivery document shape

```json
{
  "deliverables": [{
    "id": "upload-finalizes-meeting",
    "title": "Upload finalizes a meeting",
    "outcome": "A user uploads audio and receives the finalized meeting artifacts",
    "componentIds": ["app", "core", "ml"],
    "status": "planned",
    "dependsOn": [],
    "acceptance": ["The finalized transcript survives a page reload"]
  }],
  "tasks": [{
    "id": "core-upload",
    "deliverableId": "upload-finalizes-meeting",
    "componentId": "core",
    "title": "Accept and persist uploads",
    "summary": "A valid recording is stored safely and queued for processing.",
    "scope": ["Accept the upload through the API and publish a durable processing job"],
    "contractIds": ["upload-api"],
    "status": "planned",
    "dependsOn": [],
    "prerequisites": ["Regenerate API clients before dependent tasks start"],
    "acceptance": ["The API persists the upload and emits its job once"]
  }],
  "validation": [{
    "id": "upload-journey",
    "level": "end-to-end",
    "deliverableId": "upload-finalizes-meeting",
    "title": "Upload to finalized meeting",
    "testIds": ["upload-journey-scenario"],
    "entryPoint": "The user's upload action",
    "file": "tests/e2e/upload.test.ts",
    "command": "npm run test:e2e",
    "environment": "App, Core, ML and infrastructure running together",
    "realDependencyIds": ["app", "core", "ml"],
    "substitutedDependencyIds": []
  }, {
    "id": "core-upload-boundary",
    "level": "component-integration",
    "taskId": "core-upload",
    "title": "Upload API persists and publishes",
    "testIds": ["upload-api-scenario"],
    "entryPoint": "POST /meetings/{id}/upload",
    "file": "tests/integration/upload.test.ts",
    "command": "npm run test:integration",
    "environment": "Real Core service with containerised storage and queue",
    "realDependencyIds": ["core"],
    "substitutedDependencyIds": []
  }],
  "branches": [],
  "evidence": []
}
```

The example IDs must match the project's components, feature contracts, and test scenarios. Add App and ML tasks before this example deliverable is ready for implementation.

### Readiness and compatibility

The viewer shows each deliverable's user outcome, connected components and end-to-end tests above its nested component tasks and boundary tests. It surfaces missing scope, contracts, test plans, test commands, dependencies and evidence as delivery gaps. Declaring something `done` never hides these gaps; completed tasks alone cannot prove an end-to-end deliverable.

Drafts may be incomplete. Reference errors, invalid component ownership, contracts outside a task's boundary and dependency cycles are rejected. The viewer does not execute authored commands; agents and developers run them in the correct environment and attach the results.

Existing documents using `milestones` and `slices` are normalised when read: milestones become `deliverables`, slices become `tasks`, `milestoneId` becomes `deliverableId`, and `sliceId` becomes `taskId`. IDs, dependencies, status, contracts and validation evidence are preserved. Reading does not rewrite files; the next delivery authoring or progress operation writes the canonical names. New CLI/MCP requests and generated schemas use the new names.

Older generic `tasks` without component ownership are preserved as `undecomposedTasks`, with their branch and evidence associations stored as `legacyTaskId`. They remain visible as work needing decomposition. Move them deliberately into component tasks and linked validation; do not invent ownership or passing evidence. Missing deliverable outcomes and components remain visible planning gaps. New branch associations use `taskId`. Frozen source documents retain their original terminology and file paths.

## Local configuration

Workspace groups and checkout paths live under `GROUNDWORK_HOME`, or `~/.config/groundwork-v2` by default. They are not written into project plans. Linked Git worktrees are discovered automatically; independent clones must be registered explicitly. Project-scoped navigation keeps reused feature IDs separate. The central dashboard shows each checkout independently, including conflicting branch versions.

The service binds to 127.0.0.1. HTTP mutations require a local session token and reject foreign browser origins. It is a local development tool; the product domain does not expose this service. Public hosting requires a separate deployment design.
