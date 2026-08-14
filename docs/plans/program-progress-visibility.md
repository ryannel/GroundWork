# Implementation Plan: Programs as a First-Class Unit (Progress Visibility in the Docsite)

**Status:** NOT STARTED — opened 2026-07-29 from a live magpie session where the owner asked "is the graded library program complete?" and the framework could not answer. Findings below are from that session; no code written.
**Audience:** An engineer or agent implementing this change. §1 is the evidence, §2 the root causes, §3 the proposed shape — the shape is a proposal to be designed against, not a settled contract.
**Scope owner:** `lib/bet-status/` (the `status` renderer), `operating-contract.md` Protocol 11 (the checkpoint snapshot's Program section), the bet pitch template's frontmatter, and the `docs-site` generator.

---

## 0. Read this first — the mental model

**A program is the unit the owner thinks in, and it is the one unit GroundWork cannot answer for.**

Bets are first-class: a pitch with `status:` frontmatter, a five-phase state machine, an archive directory, a rendered status page. Programs are a hand-written markdown file. So the framework can tell you everything about one bet and nothing about the arc of work the bets belong to — which is the altitude the owner actually asks at.

This is not a reporting nicety. A program is where sequencing lives ("Bet 3 wants Bet 2's filtering"), where the shared architecture lives, and where "are we done?" is decided. Leaving it un-modelled means the owner's most natural question is answerable only by forensics.

---

## 1. The evidence

A real session, 2026-07-29, in `~/Workspace/magpie`. The owner asked whether the Graded Library program was complete. Answering it took **five forensic steps**, none of them the framework's own reporting:

1. Read `docs/bets/graded-library-program.md` — prose, no frontmatter, no status markers.
2. `ls docs/bets/_archive/` and eyeball 23 directory names for the ones that look like members.
3. `grep` each candidate's `pitch.md` frontmatter for `status:` to confirm `delivered`.
4. Infer Bet 4's existence from a paragraph, and its absence from a **missing directory**.
5. Confirm Bet 4 was never built by finding a source comment in the product — `App/MagpieApp.swift:54`, *"NOT Bet 4's managed coverage dashboard."*

The answer was: 3 of 4 delivered, Bet 4 never picked up. Nothing in `docs/` or in any rendered view said so.

**What the framework's own answer was.** `npx groundwork-method status` in that repo returns, in full:

```
## Program
_Program — unchanged since less than a minute ago: 23 delivered · 0 in flight · 97 queued (full picture: the bet's status page)._
```

True, and useless at this altitude. It is a global count across every bet ever run. It does not know a program named "Graded Library" exists, cannot say which bets belong to it, and cannot say one of its members was never started.

**A second, sharper failure.** `npx groundwork-method status --bet selective-lift` **errors**:

```
✖ status: no pitch found at docs/bets/selective-lift/pitch.md
```

The bet is delivered, so its pitch lives at `docs/bets/_archive/selective-lift/`. `user-legibility` Wave 2 (C2) deliberately removes the docsite status page at archive. So **the moment a bet completes, its rendered status becomes unreachable** — exactly when it becomes program history someone wants to survey. The docsite is left a museum of documents with no state.

**A related symptom worth noting:** that same command reports **97 queued**. The queue is `discovery-notes.md`'s `## Bets` bullets, which has become a landfill — no grouping, no priority, no program association. It is the "what's left" half of the program picture and it carries no structure.

---

## 2. Root causes

**RC1 — A program is not a first-class artifact.** `graded-library-program.md` sits loose in `docs/bets/` with no frontmatter, no schema, no lifecycle. The framework does not know it exists. Compare a bet, which has all four.

**RC2 — No membership link.** The program doc names *"Bet 1 — Versioned graded-analysis pipeline + fast survey"*; the directory is `graded-library-foundation`. The only connector is a human-written H1 suffix in the pitch (`· Graded Library / Bet 1`) — a convention, not a contract, and nothing computable. Membership must be re-derived by a human reading prose every time.

**RC3 — Unstarted members are invisible.** Delivered leaves an archive directory. In flight leaves an active directory. **Not-yet-started leaves nothing at all.** Bet 4 exists only as a paragraph in a document nothing parses. So "what is left in this program?" — the completeness question — is structurally unanswerable from state.

**RC4 — Archiving destroys the rendered view.** Per RC-evidence above: `status --bet <slug>` resolves only `docs/bets/<slug>/pitch.md`, and the archive step removes the status page. Delivered work has no rendered status anywhere.

**Where this lands in code:** `lib/bet-status/index.js` — `buildProgram()` (~:234) assembles three sources (archived from `_archive/`, in-flight from active bet dirs, queued from `discovery-notes.md` bullets); `renderProgramMarkdown()` (~:404) flattens them to the one-line summary. Neither has a program dimension. The contract they implement is `operating-contract.md` Protocol 11's *Program section*, which likewise defines the program as a flat chronological queue of all bets.

---

## 3. Proposed shape

Design against this; do not treat it as settled.

1. **Make `program` a first-class artifact.** Frontmatter carrying `slug`, `title`, `status`, and an **ordered `members:` list of bet slugs — including ones not yet started**. That single list is what makes "3 of 4, Bet 4 not started" computable, and it is the minimum that fixes RC3.

2. **Two-way membership.** Bets declare `program: graded-library` in pitch frontmatter. The program lists its members; each member names its program. Two-way so membership survives archiving and neither side silently drifts.

3. **Teach `status` about programs.** Group by program and render a member ladder with per-bet state — delivered / in flight / queued / **not started** — instead of a flat global count. The flat count stays as the cross-program roll-up, but it stops being the only view.

4. **A program page in the docsite.** `status --write` emits and refreshes it. This is the owner's actual ask: *"progress should be very obvious in the doc site."* The program page is where "where are we?" gets answered without a conversation.

5. **Delivered work keeps a rendered view.** Either archived bets retain a status page, or the program page carries the per-member roll-up. Today, completing a bet deletes the ability to see it — inverting the fix RC4 needs.

6. **Consider the queue.** 97 undifferentiated `## Bets` bullets is its own problem. Program membership would absorb some of them; the rest need grouping or triage. Possibly a separate plan — flagged here because it is the same "what's left?" question.

---

## 4. Acceptance

The session that opened this plan is the test. In a repo with a multi-bet program, an agent (or the owner) can answer **"is this program complete?"** from one rendered view, in one step, and that view names the unstarted member. No directory listing, no frontmatter grepping, no reading product source comments to discover that a bet was never built.
