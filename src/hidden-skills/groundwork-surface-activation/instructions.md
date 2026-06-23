---
name: groundwork-surface-activation
description: >
  Activates a new surface on a live product — the mobile app eighteen months in,
  the CLI alongside an existing web app. Registers the surface, runs its type's
  design track when no section for that type exists, scaffolds the app (or records
  `scaffold: manual`), and triages every capability ledger row so divergence from
  the existing surfaces is a decision on record, never silent drift. On a
  pre-restructure product with GroundWork docs but no surface registry, it
  bootstraps `docs/surfaces.md` first.
---

# groundwork-surface-activation

Adding a surface to a live product is the moment silent divergence is born. Every capability the product shipped before this surface existed now carries an unasked question — does it reach the new surface, and when? Left unanswered, those questions resolve themselves by accident: the surface launches with whatever subset was convenient, users discover the gaps, and no document can say whether any gap is a plan, a choice, or an oversight.

This skill makes the sync decision deliberate, once, recorded. Steps 1–3 — register, design, scaffold — are the per-surface increments of setup phases that already ran; the ledger triage (Step 4) is the skill's reason to exist: every existing capability row gets the new surface's column filled as `planned`, `omitted`, or `n/a`, and every future bet inherits those decisions instead of re-deciding them from memory.

The registry and ledger contract lives at `.groundwork/skills/templates/surfaces.md`. Read it before touching either artifact — `docs/surfaces.md` and `.groundwork/surfaces.json` are projections of the same decisions, written together in every change this skill makes.

Apply the `groundwork-writer` skill when producing or modifying any document. Declarative, assertive, zero-hedging.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs this skill. Read it before taking any other action. This is a **Maintenance** skill (see Lifecycle Modes): Protocols 1 (Discovery Notes), 2 (Living Documents), and 4 (Pacing) apply throughout; Protocols 8 and 9 (Review Gate, Review Invocation) fire when a Living Documents update is a reversal — establishing a contract-compatibility stance that overturns an architecture Key Decision is the case this skill is most likely to hit. There is no phase cache, no hand-off file, and no fresh-context recommendation — an activation starts and finishes inside one conversation. From `.groundwork/cache/` it reads only `discovery-notes.md`.

Any working file — a bootstrap reconstruction awaiting the user's confirmation, a triage draft for a long ledger — lives at `.groundwork/cache/surface-activation-draft.md` and is deleted when the activation completes. Final artifacts go to `docs/` and `.groundwork/surfaces.json`, never to the cache.

---

## Registry bootstrap — pre-restructure products only

A product that adopted GroundWork before the surface model exists has canonical docs but no `docs/surfaces.md` — neither the architecture commit nor the brownfield extract wrote a registry for it, so without this bridge it never gains one. When `docs/surfaces.md` does not exist, bootstrap before anything else. When it exists, skip this section entirely — re-running the bootstrap on a registry project would overwrite decisions already on record.

Reconstruct the registry from what the project already proves:

- **`docs/architecture.md`** — read its body for the surface detail: it names the services, the surface apps among them, the access paths, and the core's deployment as decided. (This skill runs after setup, so there is no Downstream Context file to read first — the published doc body is the record.)
- **`docs/infrastructure.md`** — the scaffold's record of what actually exists: the apps, ports, run commands, test mediums. Where the architecture and the infrastructure doc disagree, the infrastructure doc describes today and wins.

Enter every current surface as `active`, with the fields the docs support: type, platform, core access, auth, scaffold (the generator that produced it, or `manual`), test medium, design-track reference into `docs/design-system.md`. Write the Capability Core section from the deployment as observed. Leave the Capability Ledger **empty — table headers, zero rows**. Reconstructing capability parity from a live product is expensive and fuzzy; an empty ledger is honest ("parity unknown until a bet touches it") where a synthesized one would be confidently wrong. Rows grow per-bet from here, written by bet validation.

Present the reconstruction to the user before writing — the docs cannot reveal everything (the auth model a surface really uses, a half-abandoned app that should enter `dormant`), and a registry born wrong propagates wrong into every consumer. On confirmation, write `docs/surfaces.md` and `.groundwork/surfaces.json` together per the template contract. Then proceed to Step 1 for the new surface.

---

## Step 1: Register

Establish the new surface's registry entry with the user: slug (kebab-case, never renamed — rename means retire and add), type, platform, status, core-access path, auth model, scaffold target, test medium, design-track reference. Most fields are settled by inspection; two are architecture decisions wearing registry fields, and they get a real conversation:

- **Core access.** Direct, gateway, or BFF is asked, not presumed. Surface the trade-space against what the architecture already runs — an existing gateway argues for joining it; a surface with needs the shared API cannot serve cleanly argues for a BFF — and let the user decide.
- **Auth.** The new surface's auth model against the core, in the architecture's terms. A surface that cannot use the existing auth path (a CLI that needs tokens where the web app uses session cookies) is a real decision, not a field to fill.

**Contract compatibility.** A new surface that deploys independently of the core — and a second deployed artifact does — turns "we changed the contract" from a refactor into an incident the moment release cadences diverge. If `docs/architecture.md` carries no contract-compatibility stance, establish one with the user now and record it under the architecture's Binding Constraints via Living Documents. When the stance overturns a committed Key Decision, that is a reversal: the full Reversal Protocol applies, review re-gate included.

Write the registry entry and the JSON twin in the same change.

## Step 2: Design

A surface needs its type's design vocabulary, not a design system of its own. When `docs/design-system.md` already carries a section for the surface's type, design is done — point the registry's design-track reference at it and move on; type sections are shared by every surface of that type.

When no section for the type exists, run the type's track lazily against the existing foundation: load the track file at `.groundwork/skills/groundwork-design-system/tracks/<type>.md` and execute its Phase 5 in full — translation, independent review, guided walkthrough. The brand conversation (the foundation's Phases 1–4) ran once at setup and is not re-run: a product has one personality no matter how many types express it. This skill stands in for the foundation flow the track normally returns to — where the track expects the brand synthesis from the design-system cache, read the committed foundation sections of `docs/design-system.md` instead (they are the durable form of the same decisions), and the commit below replaces the foundation's Phase 6.

On the user's approval, append the new type section to `docs/design-system.md` and add the type's Tier 2 block to `.groundwork/config/brand-tokens.json` (`terminal` from the cli track, `visual` from graphical-ui; agentic-protocol contributes none), following the contract at `.groundwork/skills/groundwork-design-system/templates/brand-tokens.md`. The block carries the same values as the section just written — a mechanical projection, not a second conversation. Delete the track's draft directory (`.groundwork/cache/design-system-draft/`) once the section is committed.

## Step 3: Scaffold

When the surface's `scaffold` field names a generator, generate the app: one invocation, named by the surface's slug, parameters per the per-surface pattern in `.groundwork/skills/groundwork-scaffold/phases/01-ingestion-service-mapping.md` — its Generator Capability Mapping table is the contract between architectural language and generator flags. Confirm the invocation with the user before running it; fixing generated code is harder than correcting a flag.

When the field is `manual`, no generator runs. `manual` is first-class — the surface participates fully in design, bets, the ledger, and tests before tooling exists for its platform.

Either way, the operational expectations are the same and go on the record: a health endpoint (or the medium's equivalent liveness probe), `./dev` integration so the surface boots with the rest of the topology, and registration in the `surfaces` test fixture — re-invoke `system-test-runner --surfaces` with the full active set from `.groundwork/surfaces.json` so the fixture map gains the new slug with its medium and reach. For a generated surface these arrive with the scaffold; for a manual surface they are obligations its implementation must meet to keep the registration honest. Update `docs/infrastructure.md`'s Surfaces group with the new entry either way (Living Documents).

## Step 4: Triage the ledger

The step that earns this skill its existence. Walk every existing capability row with the user and fill the new surface's column. Each cell takes exactly one state:

- `planned` — will ship here; carries a bet ref or a discovery-notes pointer. The `planned` cells are the new surface's bet backlog.
- `omitted` — a deliberate product decision not to ship here, with a one-line rationale a future bet may revisit.
- `n/a` — structurally meaningless on this surface; no payload.

No cell is left empty — an empty cell is an undecided divergence, the exact thing this skill exists to prevent. `delivered` is not a triage outcome: nothing has shipped on a surface that was just born. The one exception is registering an artifact that already exists and already carries a capability (a brownfield CLI brought into the registry late) — there `delivered` is legal with the delivering bet named, claimed only where the evidence exists.

Pace the walk as proposals, not interrogation. Read the rows, propose dispositions for clusters of related capabilities with the reasoning attached, and let the user react. Row-by-row questioning exhausts the user before the interesting decisions arrive; per-cluster proposals surface the pattern and reserve conversation for the rows where the user pushes back. Every row still gets decided — clustering is pacing, not skipping.

Update both registry twins in the same change: the prose ledger gains the column, and every entry in `.groundwork/surfaces.json`'s `capabilities` array gains a cell keyed by the new slug — a missing cell key is the machine form of the illegal empty cell.

On a bootstrap run the ledger has headers and zero rows, so the triage is complete by construction. Say so plainly; do not invent rows. The honest-unknown stance holds — rows arrive as bets touch capabilities.

## Step 5: Hand off

`planned` cells are commitments, and commitments that live only in a table get rediscovered instead of delivered. Cross-post every `planned` cell as a bullet under `## Bets` in `.groundwork/cache/discovery-notes.md`, naming the capability key and the target surface — bet discovery reads that section, so each deferral becomes candidate scope for the next pitch instead of a memory. Ordinary bets deliver them; activation never starts delivery itself.

Close out:

1. **Report what the activation produced**: the registry entry (and the bootstrap, when it ran), the design section appended or found existing, the scaffold result (generator output, or the manual obligations recorded), the triage in numbers (rows walked, cells per state), the discovery-notes entries added, and every doc updated via Living Documents.
2. **Capture stray signals** under their headers in `.groundwork/cache/discovery-notes.md` (Protocol 1).
3. **Delete** `.groundwork/cache/surface-activation-draft.md` if it was created.
4. Hand off to the `groundwork-orchestrator` skill.

---

## Quality Standard: What a Real Triage Looks Like

The triage fails when it fills cells without recording decisions. A column of bare states is a parity nag wearing a ledger — it points nowhere, and the next bet inherits nothing.

**Shallow triage (insufficient):**

```markdown
| Capability | web-app | support-cli |
|---|---|---|
| `order-flow/place-order` | delivered (`order-flow`) | planned |
| `order-flow/order-status` | delivered (`order-flow`) | planned |
| `account-recovery/reset-credentials` | delivered (`account-recovery`) | planned |
| `storefront/theme-preview` | delivered (`storefront`) | planned |
```

Every cell `planned`, no refs, no rationale, nothing cross-posted to discovery notes, the JSON twin untouched. No decision was made — the column says "sync everything eventually," which is the silent drift the triage exists to replace, now with a timestamp.

**Deep triage (required standard):**

```markdown
| Capability | web-app | support-cli |
|---|---|---|
| `order-flow/place-order` | delivered (`order-flow`) | omitted — operators support orders, they never place them |
| `order-flow/order-status` | delivered (`order-flow`) | planned (discovery-notes — first capability the support team asked for) |
| `account-recovery/reset-credentials` | delivered (`account-recovery`) | planned (discovery-notes — pairs with order-status in one support bet) |
| `storefront/theme-preview` | delivered (`storefront`) | n/a |
```

Plus, in the same change: two `## Bets` bullets in discovery notes naming each capability key and the target surface with the reasoning, and every `capabilities` entry in `.groundwork/surfaces.json` gaining a `support-cli` cell with identical states and payloads. Every column decided, every decision findable.

The same depth standard applies to the other outputs:

- **Registry entries** carry every field with a real value — an `active` surface with no test medium, or a design-track reference pointing at a section that does not exist, is an entry that will fail its first consumer.
- **The bootstrap** names what each reconstructed field was read from (which architecture decision, which infrastructure row) so the user confirms evidence, not guesses.
- **Manual-scaffold obligations** are concrete and checkable — the health endpoint's path, the `./dev` target, the fixture slug — not a sentence saying the surface should integrate eventually.
