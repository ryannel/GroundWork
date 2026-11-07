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

## Scan the registered workspace

Select the repository and full commit from the authorised source. Use a clone root laid out as
`<clone-root>/<organisation>/<repository>`. The checkout's working tree does not set the scan pin.

```sh
npm run scan:model -- --workspace <id> --repo <organisation/repository> \
  --commit <full-sha> --clone-root <clone-root> --out <new-workspace-folder>
npm run workspace -- check <new-workspace-folder>
```

For a verified retained source checkpoint at the same pin, pass `--source-pass <folder>` to
verify and reuse its completed shards. A fresh span check uses the pinned Git tree.

The scan writes a separate candidate with native `ev:` evidence and updated model files. Review the
candidate and its receipt before applying data. A source span can be refreshed when it resolves to
the pinned code. The same filename or line number alone does not establish continuity. Report the
repository tree, source files checked, model records refreshed and unresolved references. An
unexamined path cannot establish absence or justify removing a step.

Pass an accepted packet with `--accept <file>`. It names the repository and commit. Each
handler row records the fingerprint of the current handler and a complete, cited observation.
Each contract row records the current record fingerprint, exact values and evidence IDs.
If the model cites a cached record, pass `--analysis <receipt.json>` with the repository, commit
and exact SHA-256 hashes of the cache families. The scan promotes the cited records and their
supporting evidence into the candidate.

Keep human-written conclusions in a review file until a person accepts them. Reconcile handler steps
by an aligned source span and a control-flow path, retaining their declared IDs. If the match is
ambiguous, preserve the old step and report the candidates. Check request and response shapes against
the route binding and declared type. A local declaration does not prove an external contract.

## Owners and partners

- **Owners come from evidence.** Report the handles the evidence names for each system, most specific first: a
  folder's CODEOWNERS, the repo's CODEOWNERS, Backstage `spec.owner`, the repo's GitHub teams, the deployment
  config. Map each to a team through its `handles` in `workspace.yaml`, and propose a handle that no team holds. Confirm the declared
  `team:` in `system.yaml` against those observations. Keep unsupported ownership open.
- **A partner's systems are read from its documents.** Record the accessible document reference and
  whether the conclusion comes from a declared contract or prose. Keep the implementation, handlers
  and owning team open when the evidence does not establish them.

## Interpret and improve

Use the evidence to explain probable purpose, actors, actions, journeys and relationships. Keep
interpretation in a separate review file with an **Inferred** label, confidence, rationale and
limitations. A person accepts any LLM-produced row before a deterministic command applies it.

When tooling misses, misstates or repeatedly needs manual reconstruction of relevant behaviour, follow
[learning from scan gaps](learning.md). Treat a reproducible tooling gap as repair work within the authorised
scan, not just a caveat to copy into the next report. Persist the reproducer and regression, fix the shared
tool or process, verify it, then regenerate affected evidence. In parallel runs, integrate shared tool changes
at a checkpoint so workers never unknowingly mix analysis versions. Genuine missing runtime evidence stays
unknown; LLM guesses cannot close a source-proof gap.

## Finish the requested scope

Publish only validated selections. Report the examined revision, coverage, partial questions,
inferences, exclusions and freshness authority. A local Git observation does not establish remote
or deployed state. Follow [landscape reconciliation](../groundwork-landscape/SKILL.md) or
[chart maintenance](../groundwork-diagram/SKILL.md) when the authorised change affects those views.
