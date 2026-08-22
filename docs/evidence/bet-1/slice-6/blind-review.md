# Blind review — Bet 1, slice 6: the findings tooling

Reviewer: a fresh session, no contact with the builder. The builder had run twelve D16 mutations and a hostile-shape table, so the review hunted where those did not reach: the backfill's fidelity, the CI step's real behaviour in a clean checkout, and parser edges. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

MUST FIX:

1. A finding heading at the wrong level — `### F12` or `##F12` — was invisible to check, silently. The bet's clause could fail without a word. Fixed: any heading whose text means to be an entry either parses at level 2 or raises a problem quoting the line.
2. The backfill's single-class-per-entry rule was invented by nobody's ruling and erased the unrun-proof history that D16 itself counts. Ruled in the amended D18: an entry records one Class line per defect class it holds, each pair counting once. F7–F11 carry unrun-proof beside green-but-wrong; recur reports both classes over threshold, both answered by headings.

SHOULD FIX (all landed):

3. The parser could not read a ledger that quotes its own formats — fenced examples parsed as real entries. Fences now skip whole.
4. Duplicate finding ids were silently both counted; now named.
5. Entry.Line was a claim with no reader; problems now print file:line.
6. The journal ref was local-only at bet close — the per-slice backup push could not carry it (the proxy allows only branches). The mirror branch groundwork-journal and D20 answer it; F12 records it.
7. No .gitignore protected the ruled-uncommitted sidecar; added.

NITS (landed): F5's detail matched to its prose; "1 problems" singular; dash-variant messages say the dash is wrong instead of blaming the vocabulary.

## What the close-out exercised

Appending F12 pushed `other` to its own threshold, and recur failed the real ledger — the counter catching a live recurrence at bet close, first time out. D10's own rule (heavy other use means the list is short) produced D21: the host-limit class, with F1 and F12 re-classed. The system fed itself.

## What held up

The backfill was exactly labels — 0 deletions, every catcher matching its entry's prose. The CI step genuinely gates in a clean checkout. The builder's mutation tables were honest — the reviewer re-ran six and each failed its named test. Trailing whitespace, tabs, label order, case, BOM, and NBSP probes all failed loudly or parsed correctly.
