---
id: rebuild
title: The GroundWork rebuild
goal: Replace the old framework with one whose claims are proved by machinery, not by prose.
done: Three live installs run on the new framework, the old generators are deleted, and the bet after that is delivered by the new framework itself.
ladder:
  - id: bet_0
    line: CI on both lines, the test runner, the port list, and the first ledger entries.
    proof_sketch: A failing test turns main's CI red, and taking it out turns it green.
  - id: bet_1
    line: The journal and the CLI skeleton that measure every bet built after them.
    proof_sketch: Three different verbs each write a line to the journal ref, and two branches that both wrote lines merge with both surviving.
  - id: bet_2
    line: The battery, behind one verify verb.
    proof_sketch: It classifies two repos it was never tuned against, and produces no false reds on this repo's own history.
  - id: bet_3
    line: Planning and the board, so a goal turns into proofs nobody can fake by editing.
    proof_sketch: A two-milestone bet decomposes into a board that starts red for the right reason, and three slices each turn exactly their own row green.
  - id: bet_4
    line: The project board, so the planning record for the repo you are in is visible.
    proof_sketch: The rendered position matches one computed by hand from git, with the daemon running and again with it stopped.
  - id: bet_5
    line: The method rig, which tests the parts of the spec that call for judgment.
    proof_sketch: A rubric returns red against a known-bad transcript held out from its own authoring.
  - id: bet_6
    line: The Record: documentation checked mechanically instead of hoped over.
    proof_sketch: Checks calibrated on two repos pass unchanged on a third held out from that tuning.
  - id: bet_7
    line: The corpus, and the claim that a small body of prose does the work of a large one.
    proof_sketch: The word target is written before any corpus text, and the published count lands inside it.
  - id: bet_8
    line: Review at human pace, working on its own at dial slice.
    proof_sketch: A reviewer answers fixed comprehension questions from the capsule alone, and the blind author's transcript holds no implementation.
  - id: bet_9
    line: Autonomy and the dial, with the owner kept caught up.
    proof_sketch: A bet runs at dial bet to completion, and every pause matches the stopping rule and is journaled with its reason.
  - id: bet_10
    line: The portfolio: one address for every project, and a seam for a second host.
    proof_sketch: Two registered projects render positions checked against hand-computed expectations.
  - id: bet_11
    line: Front-door proofs, taken from where the user actually stands.
    proof_sketch: Breaking the screen fails the UI case while its headless twin still passes.
  - id: bet_12
    line: The greenfield door: a description of intent becomes a working product.
    proof_sketch: One intent conversation carries a product with a real ambiguity to its first green capability, settled by a recorded decision.
  - id: bet_13
    line: The brownfield door: an existing system wrapped without a rewrite.
    proof_sketch: Install into a real multi-language repo the framework has never seen, and leave one socket unmapped on purpose so it renders red.
  - id: bet_14
    line: Operating what shipped: patches, releases, and production signal.
    proof_sketch: A break-glass patch ships, and the next normal slice fails on the specific gap the patch left.
  - id: bet_15
    line: Updates and migration, moving what already exists onto the new framework.
    proof_sketch: An update reconciles framework-owned files against three collision shapes and touches nothing project-authored.
  - id: bet_16
    line: Retirement and cutover, so the new framework stands on its own.
    proof_sketch: The battery passes against a repo built by three of the retired generators, and then they are deleted.
---

# The rebuild

This is the program file for the rebuild itself. It says what the program is for, what would make it done, and which bets get us there.

The ladder above is the ratified one in `docs/ladder.md`, one line and a proof sketch each. That file stays the fuller account: its done-when conditions, its coverage tables, and its rules for running the ladder. This file is what the tools read.

Only the next bet is designed in full. A later bet on this ladder has no files of its own, and that is the point of a sketch — it says what the bet would deliver and what would prove it, without pretending anybody has done the work of cutting it.
