---
name: groundwork-scan
description: Scan the code behind a Groundwork workspace and bring its system model up to date. Finds the repos of every system from system.yaml, runs one groundwork-explore per repo in parallel, merges the fragments into each system's contracts.yaml and handlers.yaml with stable ids, validates, reports what is new, changed and vanished (and which curated flows, journeys and plans now point at nothing), moves each repo's high-water mark, and asks the owning teams to confirm. Use when asked to scan, refresh, re-scan or update the system model from code, or with --since for an incremental scan of what changed since the last one.
---

# Scan a workspace

The system model is what runs today: `<workspace>/domains/<d>/systems/<s>/` holds the facts, and plans are
overlays on it. This skill keeps the generated part of the model true to the code. It never designs anything and
never edits what people wrote.

```
/groundwork-scan <ws> [system …] [--since]
```

Without `--since` every repo is read in full. With `--since`, each repo is read only where it changed since its
high-water mark, and repos with no mark yet get a full read.

## What is whose

| File                                          | Written by                                                  | The scan may                                                                         |
| --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `domains/<d>/domain.yaml`                     | people                                                      | read only                                                                            |
| `domains/<d>/systems/<s>/system.yaml`         | people: `name`, `does`, `team`, `repos`, the component list | read only; propose additions in the report                                           |
| `domains/<d>/systems/<s>/contracts.yaml`      | the scan                                                    | rewrite entries with `origin: extracted`; leave `seeded` and `curated` entries alone |
| `domains/<d>/systems/<s>/handlers.yaml`       | the scan                                                    | as for contracts                                                                     |
| `story.yaml`, `flows/`, `journeys/`, `plans/` | people                                                      | read only; report what no longer matches                                             |
| `scans/<org>/<name>.yaml`                     | the scan, through `tools/scan-mark.ts`                      | write, only after the merge validates                                                |

A `curated` entry in a generated file is one a person corrected; the scan proposes changes to it in the report
instead of overwriting it. `system.yaml` overrides `name` and `does` for its components: the scan's own `does` is
only the fallback.

## Steps

1. **List the repos.** Read every `system.yaml` in the workspace (or the systems you were given) and collect
   `repos:` with the system, domain and `team` each belongs to. A repo listed by two systems is one explorer whose
   facts are split by component; say so in the brief.

2. **Get the code.** Clone or update each repo outside the Groundwork repo, without blobs you will not read:

   ```bash
   dir=${GROUNDWORK_CACHE:-$HOME/.cache/groundwork}/clones/<org>/<name>
   git clone --filter=blob:none https://github.com/<org>/<name>.git "$dir"   # first time
   git -C "$dir" fetch --quiet origin && git -C "$dir" checkout --quiet --detach origin/<branch>
   ```

   The branch is the one in the repo's scan file, or the default branch. A repo you cannot reach is skipped and
   named in the report; its mark does not move.

3. **Work out what to read** (with `--since`):

   ```bash
   node tools/scan-diff.ts <workspace> <org/name> "$dir" --json
   ```

   - exit 2: no mark yet; read this repo in full;
   - "up to date": nothing changed since the mark; skip the repo;
   - otherwise the work list: `reexplore` (facts whose cited files changed, with the files), `explore` (new files
     no fact cites), `vanished` (facts whose files were removed), `renamed` (paths to rewrite, and whether the
     content changed too) and `commits` (how far behind the model was).
   - `rewritten: true` means the mark is no longer in the repo's history (a force-push or a squash); the tool
     compared file contents instead, and every uncited file is listed to explore. Mention it in the report.

   A renamed file with no other change needs no explorer: the merge rewrites the paths in its facts' sources.

4. **Brief the explorers, in parallel**, one per repo, each with the [groundwork-explore](../groundwork-explore/SKILL.md)
   skill and:
   - the clone path and the full HEAD sha;
   - the repo id, the workspace, domain, system and team;
   - **the ids table**: every fact that cites this repo (`node tools/sources.ts <workspace> --index --repo
<org/name>`) and every id in the system, with its natural key, plus the endpoints and messages of the systems
     this one talks to (from `talks_to` and the flows), so calls resolve to existing ids;
   - for `--since`, the work list from step 3;
   - where to write the fragment: `${GROUNDWORK_CACHE:-$HOME/.cache/groundwork}/fragments/<ws>/<org>/<name>.yaml`.
     Never inside the workspace: the app reads `scans/` strictly and would refuse a fragment.

5. **Merge** the fragments into each system's `contracts.yaml` and `handlers.yaml` (see the TODO below for the tool).
   - Match every fragment entry to an existing entry by id, and by natural key when the id differs (an explorer
     that did not reuse an id); keep the existing id.
   - An `extracted` entry is replaced whole by the fragment's; a `seeded` or `curated` one is kept, and the
     difference goes in the report.
   - In a `--since` scan, entries the work list did not touch stay as they are.
   - Apply `renamed` paths to every source, in every file, including flows and journeys (their sources only; the
     only edit a scan makes to a curated file, and the report lists each).
   - `vanished` ids are removed from the generated files only when the explorer confirmed them; otherwise they
     stay and are listed as "may be gone".
   - Resolve `call: "?"` steps: match `target` against endpoints anywhere in the workspace. Unmatched, the step
     becomes `does: <what it does> (calls <target>)` and a question for the system's team.
   - A component the explorer found that `system.yaml` does not list is not added to `system.yaml`; it goes in
     the report as a proposal, with its `does`.
   - Write entries in a stable order (by id) so diffs stay small, and keep comments.

6. **Validate** the workspace (see [Validating](#validating) below). On errors, fix the fragment or the merge and repeat; never
   loosen the schema and never edit curated files to make it pass.

7. **Check attribution.**

   ```bash
   node tools/sources.ts <workspace> --missing          # every extracted fact cites code; exits 1 if not
   node tools/sources.ts <workspace> --check            # optional: ask GitHub the cited files and lines exist
   ```

8. **Report** (below), and only then **move the marks**, one per repo whose merge validated:

   ```bash
   node tools/scan-mark.ts <workspace> <org/name> "$dir" --branch <branch>
   ```

   It refuses when a fact still cites a file whose content at the cited commit is not what HEAD holds (an
   explorer read older code). Re-explore those facts; use `--force` only when the change is known to be
   irrelevant, and say so in the report. Then regenerate the agents' map: `npm run map -- md --workspace <ws>`
   rewrites `<workspace>/MAP.md` with the new heads.

9. **Confirm with the owning teams** (below).

## The scan report

Print it, and save it next to the fragments as `report.md`. Plain words first, ids in brackets.

1. **Repos**: each repo, its old and new head (`3f9c2e1 → 8a1b4d0, 37 commits`), full or incremental, and any
   skipped, with why.
2. **New**: ids added, grouped by system and kind, each with its one-line `does` or `summary`.
3. **Changed**: ids whose content changed, with what changed in a few words ("now also publishes
   `price.published`", "new branch: when the market has no list price, returns 404").
4. **Vanished**: ids removed, and ids that may be gone.
5. **Dangling**: every curated reference that now points at nothing: `[[id]]` and id fields in `story.yaml`,
   `flows/`, `journeys/` and `plans/` (search for each vanished id).
6. **Flows that no longer match handlers**: a flow step `from` A `to` B `via` an endpoint or message, with no
   handler of A that calls that endpoint or publishes that message (search the handlers' step trees, including
   nested ones), and handler calls between components that no flow mentions, when a flow covers that handler's
   trigger.
7. **Proposals for people**: components to add to `system.yaml`, `does` texts that disagree with the code,
   curated entries the code contradicts, owners from CODEOWNERS that disagree with `team`.
8. **Attribution**: the `sources.ts` summary line, and significant steps without sources.
9. **Questions** the explorers raised.

## Confirm with the owning teams

For each system with anything new, changed or vanished, write a short message to its team (from `team:` in
`system.yaml`), in plain words they would use, no ids unless they help:

> We re-read acme/pricing at 8a1b4d0. Three things look different from what Groundwork said:
> Pricing now publishes "price published" when a promotion starts, not only when a list price changes.
> The nightly rebuild no longer calls Search. Is that intended?
> We could not tell who calls `POST /rates`: is that the FX service?
> Reply here and we will update the map.

Give the user these messages to send (or file them with `gh issue create` in the repo when asked). Answers come
back as edits to `system.yaml` or as `curated` entries, never as edits to `origin: extracted` entries, which the
next scan would overwrite.

## Staleness

A repo's mark is behind when its `head` is older than the tip of its branch:

```bash
git ls-remote https://github.com/<org>/<name>.git refs/heads/<branch>
```

Say it as "as of 3f9c2e1, 37 commits behind" (`git rev-list --count <head>..origin/<branch>` in the clone). The
app says the same, and `npm run map -- repos` lists the commit each repo was read at. Suggest `--since` for those repos.

## TODO: `tools/scan-merge.ts`

Not built yet: it needs the system model's reader and writer, which are being built in `src/`. Until then, do
step 5 by hand (or with a short script in the cache directory, not in the repo), following the rules above.
When it exists it should:

- take `<workspace>` and one or more fragment paths, plus the scan-diff work list for `--since`;
- do every rule in step 5, writing only `contracts.yaml` and `handlers.yaml` (and source paths in curated files
  for renames);
- print the report sections 2 to 6 as JSON for this skill to word;
- never write `scans/`: that is `tools/scan-mark.ts`, after validation.

## Validating

```bash
npm run workspace -- check <workspace>   # the workspace, its model and every plan, read as the app does
npm run dev                              # then open /<ws>/ and each system page
```

`check` reads every file of the workspace through its schema, checks every id reference in today's model resolves
(including `call`, `publish`, `read` and `write` in handlers, and `on`), reads each plan onto the model, and exits 1
on errors, so step 6 gates step 8.
