# Final re-check

Scope: F98's four items. All closed, the flagged symlinked-root regression proven clear three ways. Its one low is F99, fixed at landing. Verdict: lands.


Micro-round re-checked. Real repo untouched — tree byte-identical to when I started, HEAD still `cbebbcf`, no stash. Everything ran on copies.

---

# Final gate — bet 3, slice 6 micro-round

**VERDICT: LANDS.** All four F98 items are closed. Nothing reopens. One new low finding worth a line in the ledger, not a round.

---

## The four items

### 1. The escape — CLOSED

The intermediate-symlink probe that read a file outside the repo and went green now comes back refused:

```
$ ln -s /tmp/claude-0/outside docs/sub        # git stores it: 120000 blob … docs/sub
plan   green
trace  red   1 proof: 1 dangling; … docs/sub/secret.md was not read for demo_s1_p:
             resolves outside this repo
```

No machine path in the line. The last-element gate keeps its own, more specific reason — a symlink at `docs/design.md` still says "is a symlink, and a design file is read as a file", whether it points at `/dev/zero` or at a file outside the repo — so the two rules do not collapse into one vaguer answer.

**The regression the driver flagged is clear.** Both sides resolve, and I checked it three ways: the same repo reached through a symlink to itself reads green; a repo under a symlinked parent chain (`/tmp/home -> /tmp/realhome`, repo at `/tmp/home/repo`) reads green; and mutating away the *root* resolution — `realRoot := root` — kills `TestADesignFileUnderRealDirectoriesStillReads`. Both resolutions are load-bearing and both are pinned.

Two containment edges beyond the brief, both correct:

- A symlinked directory pointing **back inside** the repo (`docs/sub -> docs/real`) reads. Right — that is the repo's own content.
- A sibling directory whose name extends the root's (root `…/q5`, file in `…/q5-evil`) is refused. `filepath.Rel` handles it.

Mutations: `inside` never called, `inside` always yes, root unresolved, path unresolved, and the `..` check dropped — all five killed.

### 2. The cap pin — CLOSED

`- A file over 262144 bytes, which is 256 KiB` → `262143` dies on `TestThePageWritesTheCapTheRowHolds`. Deleting the containment bullet dies on the same test, through the quoted `outsideTheRepo` constant. Rewording the constant kills it from both sides — the page pin *and* the behaviour test. The number and the refusal string each now have exactly one home.

One trivia note, not a finding: the `which is 256 KiB` gloss is free — changing it to `512 KiB` survives. The authoritative byte number is the pinned one, and this matches the shape the plan parser's caps have always had.

### 3. The boundary — CLOSED

Through the built binary: 262144 bytes reads and the anchor resolves; 262145 is refused as `is 262145 bytes, over the limit of 262144 bytes`. `>` → `>=` — which survived my sweep last round — now dies on `TestTheDesignFileCapIsDrivenAtItsBoundary`.

### 4. Code spans — CLOSED, and the example is true

Named in the `linkText` comment and in §4.1, with the direction-to-be-wrong-in argument. I checked the page's specific claim rather than trusting it:

```
## The `[a](b)` form
  the-a-form     green   ← what this makes, as the page says
  the-ab-form    red     ← what GitHub makes, as the page says
```

Both slugs are exactly what the page states.

---

## New — LOW: the containment rule is correct but its distinction is undriven

Replacing the `Rel`-based check with the naive version passes the whole suite:

```go
if !strings.HasPrefix(realAt, realRoot) {
    return errors.New(outsideTheRepo)
}
```

**SURVIVED.** And under that mutant the sibling-directory escape comes back for real — I built it and ran it:

```
trace  green  1 proof: 0 dangling; … docs/sub/design.md carries no seal in this repo
```

The shipped code is right; nothing defends it. A future simplification to `HasPrefix` would land green and reopen the escape for any path whose resolved directory extends the root's name. One case in the existing test — a design file in a sibling directory named `<root>-evil` — closes it. Worth a finding and a two-line test, not a round.

The other survivor, deleting the code-span paragraph from §4.1, is undriven prose with no machine-checkable token in it, the same as the reference-link and image sentences beside it. The two claims that *do* carry a token — the number and the refusal string — are now both pinned, which is the right line to have drawn.

---

## Gate

Every claim reproduced. `gofmt -l` and `go vet ./...` clean. `go test -p 1 ./...` green alone; `internal/battery` 124.2 s against the claimed 125.4. `verify` alone on a copy:

```
battery 11.0+rffb3f30
trace  green  24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice;
              0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0
```

Digest unchanged. The honesty row reads 933 tests, up from 929, and every one can fail. The journal holds 14 chained lines under `b3s6r3`, matching `b3s6` and `b3s6r2`.

My sweep this round: 12 mutations planted, four-way, each verified against a content hash of the whole tree before and after. 10 killed, 2 survived — one real gap (the `Rel` distinction above) and one free gloss.

Slice 6 is done. On the commit, the `Slice: b3s6` trailer and the design seal per F92 are the driver's to make.