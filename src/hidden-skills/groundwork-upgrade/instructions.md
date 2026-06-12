---
name: groundwork-upgrade
description: >
  Brings a project up to the current GroundWork framework version by executing the
  upgrade brief that `npx groundwork-method update` compiles — merging framework
  improvements into user-edited docs, running agent migrations (doc renames, registry
  bootstraps, shape uplifts), and reconciling regenerated scaffold output. One brief
  item, one explained proposal, one commit. Distinct from groundwork-update, which
  updates project documents after code changes.
---

# groundwork-upgrade

You are the judgment lane of the framework upgrade path. The CLI has already done
everything mechanical — refreshed skills, replaced the framework-owned `./dev` bundle,
copied pristine seeded docs, run scripted migrations. What remains is the work that
needs eyes: the user edited a doc the framework also improved, a document shape moved,
generator output drifted from its template. The CLI compiled that work into the
**upgrade brief**; you execute it conversationally and leave the project as if it had
been set up at the current version all along.

Apply the `groundwork-writer` skill when modifying any document. The shared operating
contract at `.agents/groundwork/skills/operating-contract.md` (contract v1) governs
this skill in **Maintenance** mode: Protocols 1 (Discovery Notes), 2 (Living
Documents), and 4 (Pacing) apply, and Protocol 8 (Review Gate) applies when an item
mutates a canonical doc. There is no phase cache beyond the brief itself.

---

## The brief is the work list

Read `.groundwork/cache/upgrade-brief.json`. If it does not exist, there is no
judgment-lane work: tell the user the install is current on this lane, point them at
`npx groundwork-method update` (or `update --dry-run` to preview), and stop.

The brief carries `from` (the version this install was stamped at), `to` (the version
it is being raised to), and `items[]`, each with a stable `id`, a `type`, a `status`,
and pointers to payloads the CLI staged under `.groundwork/cache/upgrade/` — you never
need the npm package itself.

Open the session with the shape of the work: the version jump and a one-line list of
pending items. Then walk the items **top to bottom** — the CLI ordered them. For each:

1. **Verify it applies.** Every item type has a detect step (below). An item that is
   already done or not applicable is checked off with a note, not performed.
2. **Propose, then act.** Explain what will change and why in two or three sentences,
   show the concrete diff or plan, and get the user's approval. Never batch approvals
   across items.
3. **Commit.** One item, one commit, referencing the item id —
   `chore(groundwork): <what changed> (<id>)`. Nothing outside the item's scope goes
   into its commit.
4. **Record completion** (bookkeeping contract below) before moving on.

Stop at any point the user asks; the brief survives across sessions and `update`
re-runs merge into it without duplicating items.

## Item types

### `agent-migration`

The item's `brief` field points at a staged migration brief
(`.groundwork/cache/upgrade/briefs/<id>.md`) with three sections: **Detect**,
**Transform**, **Accept**. Load it and treat it as your instructions for this item —
run Detect honestly (its "already done" and "n/a" arms are as binding as "applies"),
perform Transform within its invariants, and verify Accept before committing. When a
brief delegates to another skill's flow, load that skill's instructions rather than
improvising the procedure.

### `tier2-merge`

A framework-seeded doc the user edited, where the framework has since improved its
copy. `path` is the user's file, `incoming` is the new package content (staged in the
cache), `base_hash` is the manifest's record of what was originally deployed (null
means unknown ancestry).

Reason over both versions: what did the user change, and what did the framework
improve? Produce a merge that **preserves the user's intent and adopts the framework's
improvements** — never a mechanical overwrite in either direction, never conflict
markers. When user edits and framework improvements collide on the same passage, show
both and let the user pick. `AGENTS.md` deserves extra care: it routes every agent
session, so a broken merge breaks the project's tooling.

### `tier1-custom`

A framework-owned file (typically the `dev` launcher) the user customized, blocking
the clean replace. Show what the customization does, show the `incoming` framework
version, and either port the customization onto the new version or — if the
customization is obsolete — adopt the framework file. The user decides.

### `regenerate`

Generator output whose generator has moved since it was deployed. Re-run the recorded
generator in a scratch workspace and reconcile:

1. Create `.groundwork/cache/upgrade/regen/<artifact>/` with minimal Nx markers
   (`package.json` `{"name":"regen"}`, empty `nx.json`) and copy
   `.groundwork/config/brand-tokens.json` in if the generator themes from it.
2. Run the generator there with the item's recorded `options`, via the project's
   `.groundwork/config/generators.json` registration
   (`npx nx g <generators.json-path>:<generator> …`). If `options` is null (adopted
   output, unknown ancestry), reconstruct them from the artifact — e.g.
   `.dev/dev.config.json` carries the app name and colors — and confirm with the user.
3. Diff the regenerated files against the project, walking the provenance file list.
   Propose framework-section changes; leave user-section changes alone (a
   docker-compose service the user added is theirs; the generator's infra block is the
   framework's). An empty diff is a clean check-off.

## Bookkeeping — exact, every item

This contract is what keeps `update`, `check`, and future sessions honest. After each
item is committed (or checked off as done/n-a):

- **Brief:** set the item's `status` to `"done"` in
  `.groundwork/cache/upgrade-brief.json`.
- **Migrations** (`agent-migration` items): append the id to
  `groundwork.migrations` in `.groundwork/config/state.json` so no future update
  re-queues it.
- **Manifest** (`tier2-merge` and `tier1-custom` items): in
  `.groundwork/config/manifest.json`, set the file's entry to the merged reality —
  `hash` = SHA-256 of the file now on disk, `base` = SHA-256 of the `incoming` package
  content you merged against, `version` = the brief's `to`. (Compute with
  `shasum -a 256 <file>`.) This is what stops the same merge being queued forever.
- **Manifest** (`regenerate` items): set `generated[<artifact>].version` to the
  brief's `to`, and record the `options` you used if the entry had none.

Include the bookkeeping edits in the item's commit.

When every item is done, delete the brief and the staged payloads
(`.groundwork/cache/upgrade-brief.json`, `.groundwork/cache/upgrade/`) — cache
lifecycle rules — in a final tidy commit, and close with one line naming the version
the project now stands at. Suggest `npx groundwork-method check` as the proof.
