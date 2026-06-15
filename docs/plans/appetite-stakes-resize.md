# Plan: Resize the framework — worth + stakes, not effort

**Status:** PROPOSED — 2026-06-15. No slices executed yet.
**Audience:** Contributors reworking the prioritization/sizing concepts.
**Scope owner:** ryannel.

## §0 Mental model — the two-axis resize

A unit of work was historically sized on three axes that travelled together: how
much it is **worth** (appetite), how much is **at risk** if we get it wrong
(stakes), and how much **effort** it takes to build (complexity/estimate). The
three correlated well enough that effort became the de-facto proxy for all of
them — bigger estimate, bigger thing.

AI broke that correlation. Agents compress *execution effort* dramatically and
unpredictably: the 600-line CRUD slog and the load-bearing auth change can now
cost the same wall-clock, and neither is predictable up front. Effort is the axis
that deflated. Sizing by effort — or by its cousin, complexity — now sizes by the
thing that just got cheap and noisy.

The two axes that **survive** AI are the ones bound by human judgement and
consequence, because those do not shrink when the agent speeds up:

- **Worth** — what solving this problem is worth, judged by opportunity cost. This
  is what **appetite** already measures. AI makes it *more* central, not less:
  when execution trends toward free, worth is the only thing left to argue about.
- **Stakes** — what is at risk if we are wrong: blast radius × reversibility ×
  the human review/judgement the work demands. This is the **size** that matters
  in an AI-native shop. A tiny-effort change to a payment path is low-effort and
  high-stakes; effort would have mis-sized it.

The reframe in one line: **appetite is not an estimate and never was, so AI did
not kill it — but appetite is denominated in human-*time*, and human-time is the
unit AI destabilised. Re-denominate appetite in worth; promote stakes to the
first-class measure of size; name effort/complexity as the deflated axis it now
is.**

## Findings

| ID | Finding |
|---|---|
| F1 | Appetite is denominated in human-time ("two weeks of one person's attention") across ~7 files — the unit AI destabilised. Already framed as worth underneath, but the time anchor leads. |
| F2 | The corpus already rejects estimate-driven planning (`prioritization-and-appetite.md`, `product-engineering.md` §3, `shaping-and-appetite.md`). Appetite-as-worth is sound; only the denomination is stale. So the fix is re-denominate, not strip. |
| F3 | "Stakes" already exists informally — `product-risks.md` §6, `ai-native-product.md`, `agentic-systems.md`, `success-metrics.md` §6 — as risk/consequence severity that scales rigour. It is never named as the *sizing* axis. |
| F4 | No concept names blast radius × reversibility × review-load as one unit. The ingredients live scattered: blast radius in `reliability.md`/`security.md`, reversibility in `evolutionary-architecture.md`/`progressive-delivery.md`, review-load nowhere. |
| F5 | The artifacts reinforce the stale denomination: pitch template asks "How much time are we willing to spend?"; discovery + MVP workflows and the bet-pitch checklist all elicit/verify appetite as a time cap. Stakes is recorded nowhere on a bet. |

## Workstreams

### WS-A — Reframe the sizing model (the canonical edit)

`src/docs/principles/foundations/prioritization-and-appetite.md`

- Rewrite TL;DR + "Why this matters" around the two-axis resize (worth + stakes;
  effort as the deflated third axis).
- Re-denominate "Appetite, not estimate": lead with worth/opportunity-cost;
  demote "N weeks of attention" to one *optional* lens for work whose binding
  constraint is genuinely human-coordination time.
- Add a first-class principle: **Size is stakes, not effort** — define stakes as
  blast radius × reversibility × review/judgement load; state explicitly that
  complexity/effort is the axis AI deflated and why it now mis-sizes.
- Keep principles 2 (bet = unit of commitment), 3 (opportunity then bound), 4
  (opportunity cost), 5 (no-gos), 6 (scoring informs).
- Acceptance: a reader can answer "what does *size* mean here, and why isn't it
  effort?" from this doc alone.

### WS-B — Name stakes in the risk doc

`src/docs/principles/foundations/product-risks.md`

- Tighten §6 ("Low stakes earn a lighter pass") to name stakes = blast radius ×
  reversibility × review-load, and cross-link the canonical definition in WS-A.
- Keep the four-risk frame untouched; this is a one-section sharpening + link.
- Acceptance: §6 points at one canonical stakes definition; no second definition.

### WS-C — Mirror into the product persona + re-anchor

`src/hidden-skills/groundwork-product/references/{shaping-and-appetite,scope-and-sequencing}.md`
and `src/hidden-skills/groundwork-product/sync-anchor.md`

- Re-denominate appetite + add the stakes sizing lens in both references, in the
  persona's decision-time voice (per-item view in shaping; portfolio view in
  scope-and-sequencing).
- Recompute the sync-anchor SHA-256 for every edited source principle file so
  `./dev test contracts` (the sync gate) stays green.
- Acceptance: `./dev test contracts` passes; references read in persona voice,
  not as copied principle prose.

### WS-D — Thread stakes into the artifacts (the "first-class" part)

- `src/hidden-skills/groundwork-bet/templates/pitch.md` — reframe the Appetite
  line as worth; add a **Stakes** line (blast radius / reversibility / review
  load → the rigour the bet earns).
- `src/hidden-skills/groundwork-bet/workflows/01-discovery.md` +
  `src/hidden-skills/groundwork-mvp/instructions.md` — elicit worth + stakes,
  not "how much time."
- `src/hidden-skills/groundwork-review/checklists/bet-pitch.md` — update the
  appetite items; add a stakes item (a bet that records no stakes has not been
  sized).
- `src/hidden-skills/groundwork-review/checklists/technical-design.md` — the
  "expanded beyond its appetite" item gains a stakes-mismatch sibling.
- Acceptance: a bet pitch carries both worth and stakes; the checklist fails a
  pitch that carries neither-or-only-one.

### WS-E — Vocabulary alignment (incidental)

`src/docs/principles/foundations/product-engineering.md` §3,
`src/docs/ways-of-working/units-of-work.md`, `docs/product.md`

- Align the surface phrasing (demote "two weeks of one engineer's attention");
  no conceptual rewrite — these inherit the WS-A model.

### WS-F — Ship hygiene

- `CHANGELOG.md` — Tier-2 content change entry (propagates via the refresh/merge
  path; needs a changelog line, no migration registry entry).
- Run `./dev test contracts` (sync-anchor gate + freshness) green before commit.

## Decisions

### Settled

| # | Decision | Rationale |
|---|---|---|
| D1 | Keep appetite; re-denominate to worth/opportunity-cost. | Appetite was never an estimate — it's the AI-proof axis. Stripping it throws out the part AI made *more* important. |
| D2 | "N weeks of attention" demoted to one optional lens, not the unit. | Human-time is exactly the unit AI destabilised; it survives only where human-coordination time is the real binding constraint. |
| D3 | Size = **stakes** (blast radius × reversibility × review/judgement load); effort/complexity named as the deflated axis. | Stakes is bound by consequence + human judgement, which AI does not compress. Complexity is what AI ate — sizing by it sizes by noise. |
| D4 | Fold stakes into existing docs as a named principle; no new doc file. | Stakes is conceptually bound to appetite (sizing) and risk (consequence), which already have homes. A new file costs an llms.txt/index entry, a new sync-anchor pin, and a migration question for no conceptual gain. Reuse "stakes" — already in the vocabulary. |

### Open

| # | Question | Lean |
|---|---|---|
| O1 | One composite "size" label, or keep "stakes" as the term? | Keep "stakes" — already used in 4 files; a new label fragments the vocabulary. |
| O2 | How hard to push the "review/judgement load" sub-axis — it's the newest of the three stakes ingredients. | Name it as a first-class third ingredient; it's the one most specific to the AI-native shift (agents write more than a human can vouch for). |

## Sequencing & gates

WS-A defines the model; everything else mirrors it. Execute A → B (the two
principle docs) and confirm the prose reads right **before** propagating to C/D/E
— the references, templates, and checklists are mechanical mirrors of A's model,
and re-doing 10 files because the model prose shifted is the waste to avoid.
WS-C's sync-anchor recompute and WS-F's `./dev test contracts` are the gate that
"done" must clear.
