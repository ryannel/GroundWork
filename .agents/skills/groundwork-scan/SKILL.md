---
name: groundwork-scan
description: Scan or refresh authorised repositories into Groundwork evidence, coordinate extraction and interpretation, and improve reusable tooling when scans expose gaps.
---

# Scan repositories

For workspace-backed scans, first run `npm run --silent workspace -- list --json` in the Groundwork checkout.
Resolve the workspace id and folder from the registry, not `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

Produce a commit-pinned account of the requested repositories, their behaviour, useful interpretations and
remaining gaps. User instructions determine scope, model and parallelism. An existing stop remains in force
until the user resumes that scope; skill maintenance and fixture tests do not restart repository scans.

## Choose the requested format

| Requested work                                                    | Read when needed                                                                                                         | Output                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Current question-led scans, reusable extractors or scan freshness | [Pipeline](../../../docs/scan-pipeline.md) and [repository workflow](../../../docs/scan-trials/scan-readiness/README.md) | `scan/v1` evidence and a separate interpretation sidecar |
| Existing runtime-component or endpoint execution proofs           | [Canonical orchestration](canonical-orchestration.md)                                                                    | `knowledge/v3` bundles and snapshot                      |
| Refresh the model read by the current application                 | [Legacy refresh](legacy-refresh.md)                                                                                      | Validated production YAML and scan marks                 |

Infer the mode from the request; clarify only a material ambiguity. Read the selected guidance, not every
mode. Keep formats separate. A scan does not itself migrate the app or authorise production changes.

## Work from questions and evidence

Read the relevant previous run's learning links and existing regressions; carry unresolved patterns into the
brief rather than rediscovering them. Use scripted inventory and extraction before asking agents to
reconstruct framework behaviour.
Pin repository, commit, selection, source policy and analysis versions. For whole repositories, use
`scan:pass` with a shared cache and its checkpoint/resume or `--previous` workflow. Use `scan:entries` for
supported Spring entry discovery and `scan:entry` for bounded evidence on demand. Other framework support
must be checked against actual tooling; the fixed Go/Next.js benchmarks are not whole-repository coverage. For
C#/ASP.NET, use the [source program workflow](../../../docs/scan-trials/rescan-acceptance/csharp.md):
controller, call and schema joins across source shards require the reusable program aggregation step.

Before a corpus run, use the [re-scan preflight and acceptance contract](../../../docs/scan-trials/rescan-acceptance/README.md).
Reconcile the actual pinned roster and language/framework routing. Representative tooling proofs establish
launch eligibility; each resulting repository still needs its own coverage and publication checks. A Spring
readiness receipt cannot certify another language, framework or the whole workspace.

Account for discovered endpoints, consumers, jobs, stores and outbound boundaries, including explicit
exclusions. Trace the questions that matter: control branches, values crossing calls, stored/message/API
shapes, asynchronous continuations and failures. Do not equate inventory counts or schema validity with
behavioural coverage. Preserve source anchors, partial results and unresolved boundaries.

Parallelise independent work within the user's requested settings. Give each explorer a pinned scope,
questions, existing evidence, output location and resource bounds; use
[groundwork-explore](../groundwork-explore/SKILL.md). Keep implementation and review work proportional to
the ambiguity. Cold/warm benchmarks and bespoke acceptance packs are validation tools, not work to repeat
for every repository.

## Owners and partners

- **Owners come from evidence.** Report the handles the evidence names for each system, most specific first: a
  folder's CODEOWNERS, the repo's CODEOWNERS, Backstage `spec.owner`, the repo's GitHub teams, the deployment
  config. Map each to a team through its `handles` in `workspace.yaml`, and propose a handle that no team holds. A
  `team:` in `system.yaml` is typed only when evidence is missing or disagrees, and a typed team wins. Collecting
  this evidence is not scripted yet; read it by hand and say where each handle came from.
- **A partner's systems are read from its documents**, since we cannot read its code (the team has
  `partner: true`). Each fact is `origin: documented` and cites where it was read:
  `{ url, pointer, version }` for an API document (a JSON pointer or operation id), `{ url, heading, version }` for
  a prose page. The url may be one the app cannot reach (an internal network, Notion); cite it anyway. Read the
  document where it lives; never copy it into the workspace. Facts from prose are **Inferred**. A partner's system
  has no handlers by default: a flow hop into it ends at its endpoint. See
  [cookbook §21](../groundwork-schema/cookbook.md#21-plans-together-programmes-increments-and-partners).

## Interpret and improve

After extraction, use the LLM to explain probable purpose, actors, actions, journeys and relationships from
the source and surrounding context. Follow [interpretation](../groundwork-schema/interpretation.md): keep
the **Inferred** label visible, record confidence and rationale, and separate model usage from scripted
extraction. Source-complete does not mean interpretation-complete. Before repository-level prose, retain
an independent candidate inventory of source runtime/app boundaries and entries/operations, then reconcile
it through the discovery coverage contract in that reference. Five area attempts or component totals do not
establish activity coverage; preserve discovery-partial results and require independent challenge for a
complete discovery claim. Repair from retained evidence first, extracting only missing affected slices.

When tooling misses, misstates or repeatedly needs manual reconstruction of relevant behaviour, follow
[learning from scan gaps](learning.md). Treat a reproducible tooling gap as repair work within the authorised
scan, not just a caveat to copy into the next report. Persist the reproducer and regression, fix the shared
tool or process, verify it, then regenerate affected evidence. In parallel runs, integrate shared tool changes
at a checkpoint so workers never unknowingly mix analysis versions. Genuine missing runtime evidence stays
unknown; LLM guesses cannot close a source-proof gap.

## Finish the requested scope

Publish only validated selections. Report repository/revision coverage, supported and partial questions,
inferred interpretations, exclusions, freshness authority, reuse/work metrics and model usage where known.
For each learning gap, name the reusable correction and verification, or the reason it remains deferred.
For service exploration, bind implementations to source-declared runtime components and project bounded
queries through `src/application/scan-explorer`; keep source payloads and provider contracts distinct.
Use the [service explorer contract](../../../docs/scan-trials/service-explorer/README.md) when publishing UI
data. Reverse caller matches need target and transport evidence; similar names are only candidates.

Do not silently lower denominators, promote partial answers, rewrite old receipts or advance production
marks from an unvalidated capture. Reuse compatible indexes; invalidate affected facts and interpretations
when their inputs or analysis change. A local Git observation does not establish remote or deployed currency.

When the task includes a landscape, reconcile the new evidence through
[groundwork-landscape](../groundwork-landscape/SKILL.md). Technical boundaries remain independent of teams
and arbitrary domain/system grouping. When publication updates a workspace with reviewed charts, reconcile
its affected systems and neighbouring areas through the diagram
[maintenance workflow](../groundwork-diagram/references/maintenance.md), preserving unchanged choices.
For new charts, use [groundwork-diagram](../groundwork-diagram/SKILL.md) after publication. Evidence-only
or proposal-only scan requests retain that scope; they do not authorise production chart changes.
Complete the requested publication, interpretation and affected validation, or retain the specific
unresolved boundary alongside useful completed work.
