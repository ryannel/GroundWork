# Handoff — bet-3 slice 7, page round

Builder session, round 4. Working tree only. Base HEAD `01ab4c6` (F117 recorded).
Earlier rounds: `handoff-b3s7.md`, `-round2.md`, `-round3.md`.

## The four fixes

**(i) The cut-message sentence.** It said the row counts a cut message rather than judging it. It now
says what the row does: it judges the part it read and counts the message as cut, so a squash quoted
inside the first 65536 bytes is still `1 squashed, 1 cut`. Pinned by
`TestThePageSaysWhatACutMessageDoesToTheVerdict`, which builds the re-check's own probe — a quoted
trailer block followed by 65 KB of padding — and holds the page's phrase against the row's line.

**(ii) The cluster rule.** The page now names the trailer key set: `Bet`, `Slice`, `Tests`, with
where each is fixed. Then it works the two shapes through, so a reader can derive both verdicts
without running anything. And it carries the writer's warning: a whole trailer block reproduced
verbatim at line start reads as a squash, history does not change, so that red never clears — quote
with indentation or inside a fence.

`TestThePageNamesTheTrailerKeysTheClusterReadUses` reads the keys from `board.TrailerKeys()`, the
same source `TestTheTrailerKeysAreTheOnesThePagesDeclare` holds to the pages, and drives both shapes.
It reads the page's own verdict word out of each teaching sentence rather than hardcoding one, so a
page that taught the wrong answer fails rather than misleading a reader.

**(iii) The counter's counts sentence.** It listed counts the head no longer prints. It now matches
the head word for word — renames in, `limit` spelling — and says in one line where the count of
files that are not waivers lives now. `TestThePageListsTheCountsTheCounterPrints` reads that one
sentence, not the page: every word in it appears somewhere in section 5, so a whole-page read would
have passed a list with a count dropped. That is what the first sweep pass caught.

**(iv) The help text.** `verifyUsage` is now built with `fmt.Sprintf` from `battery.CloseScope()`, so
the help and the refusal cannot name different rows. `main.go` gained the `battery` import; nothing
else in it moved. `TestTheHelpTextNamesTheRowsTheCloseRefusalNames` holds the help text, the scope
and the refusal to one phrase in one order.

## Blanking

**10 rules, 10 killed, 0 survivors**, every baseline green, no build breaks. Two passes.

The first pass left two survivors, and both were the pin's fault rather than the rule's. The
two-shapes pin drove the row but never read the page's claim, so flipping `red` to `green` in the
sentence changed nothing. The counts pin read the whole page, where every count word appears
somewhere else. Both now read the sentence they describe.

## The gate

`gofmt -l` clean, `go vet ./...` clean.

`go test -p 1 ./internal/battery ./internal/board ./cmd/groundwork` green alone, **1m51s**;
`internal/battery` 87.0 s. The narrow set is what this round's scope allows: the only source change
outside tests is `verifyUsage` and the import it needs.

**Digest and version state unchanged.** No row's id, kind or severity moved, and
`TestThisRepoDeclaresTheBump...` — which compares the working-tree lock against `Default().Digest()`
— is green, so the rows still compute `ra48a79a`. HEAD declares `11.0+rffb3f30`, the working tree
`12.0+ra48a79a`, and `groundwork verify version` reports exactly that disagreement: R15's honest
state for an unlanded bump, resolved by the landing commit.

## Status

- [x] Three sentences fixed and pinned; help text tied to the scope.
- [x] Blanking: 10 rules, 10 killed, 0 survivors.
- [x] gofmt, vet, the three packages green alone.
- [x] Nothing committed. No ledger edits.

Evidence: `narrow.log`, `sweep8.json`, `sweep8.log`, harness `sweep7.py`.

## Restore, after the page was lost

The driver ran `git restore docs/derivation-contract.md` while checking a pin, which pulled HEAD's
copy and took every uncommitted page edit with it — section 5 whole, across all four rounds. Nothing
else in the tree was touched.

Restored from `scratchpad/final3-copy`, the committed copy this session made for the micro-round's
verify. Its page is the round-3 page exactly: its sections 1 to 4 differ from HEAD's only by the two
lines round 1 changed, which is what a diff of the first 534 lines showed. Round 4's three sentence
fixes were then re-applied from the same replacements this session ran the first time.

The page is 691 lines again — 685 at round 3, plus the six the cluster rule's new paragraphs add.

Proof it agrees with the code again: **every contract and page pin in all four packages passes**,
24 of them, including the three verdict tables whose tests fail on a row count that does not match
what they drive. `gofmt -l` clean. The narrow suite — `internal/battery`, `internal/board`,
`cmd/groundwork` — green alone in 1m48s.

`docs/derivation-contract.md` is the only path that moved. The tree is otherwise where round 4 left
it: 43 paths, digest `ra48a79a`, HEAD `11.0+rffb3f30` against the working tree's `12.0+ra48a79a`.
