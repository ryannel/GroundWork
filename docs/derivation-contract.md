# The derivation contract

**Status:** live. Section 1 lands with bet 3 slice 1, section 2 with slice 3, section 3 with slice 4, section 4 with slice 6, section 5 with slice 7.
**Audience:** anyone writing a file the tools read, and anyone changing a tool that reads one.
**Scope:** the shapes GroundWork parses, and what it does with each one.

This page is the one place a parsed shape is written down. If a tool reads a file, a commit trailer, or a tag, the shape it reads is here. Every parser's test names the section it implements, so the page and the code ship in one commit.

Later bets append their own sections.

---

## 1. The plan files

A plan is three kinds of committed markdown file, under `docs/plan`:

```
docs/plan/<program>/program.md
docs/plan/<program>/<bet>/bet.md
docs/plan/<program>/<bet>/<slice>.md
```

The directory or file name is the unit's id. `docs/plan/rebuild/program.md` declares the program `rebuild`. `docs/plan/rebuild/bet_3/bet.md` declares the bet `bet_3`. `docs/plan/rebuild/bet_3/b3s1.md` declares the slice `b3s1`. The name and the declared id have to agree.

The tree is three levels deep and no more:

- `docs/plan` holds one directory per program. A file sitting there is refused.
- A program directory holds `program.md` and one directory per bet. Nothing else.
- A bet directory holds `bet.md` and one `.md` file per slice. A directory below a bet is refused, and so is a file that is not markdown.

A `docs/plan` that holds no `program.md` at all is unrunnable, not red. There was nothing to parse, so nothing could be misstated. One `program.md` that is there and will not read is red: there is a plan, and it is misshapen.

### 1.1 Frontmatter, and the prose below it

Every machine-read field lives in the frontmatter at the top of the file. Everything below it is prose, and no parser reads it. Rewrite the prose as often as you like; the tools will not notice.

The frontmatter opens on the file's first line with `---` and closes with the next `---` line.

The frontmatter is a small, strict subset of YAML. It holds three shapes:

```
a_field: one line of text

a_list:
  - one line
  - another line

a_list_of_blocks:
  - id: first
    title: The first one
  - id: second
    title: The second one
```

An empty list is written `[]`.

The rules, all of them:

- Indentation is spaces. A tab in the indentation is refused.
- A block inside a list entry is indented to the column after the entry's dash.
- A field name is lowercase letters, digits and underscores.
- A field written twice is refused. A field the shape does not hold is refused. A field with no value is refused.
- There are no comments, no quoting, and no anchors. A `#` is an ordinary character.
- A list entry whose first word is a bare field name followed by a colon reads as a block. A line of text that begins that way cannot be a list entry — rephrase it.

And the caps, all of them. Each one is far above what a person writes and far below what would make an error message unreadable:

- A whole plan file: 65536 bytes, which is 64 KiB.
- One value: 1000 bytes.
- An id: 64 bytes.
- A path: 300 bytes.
- A field name: 40 bytes.
- Nesting: 3 levels.

A file over a cap is refused with the number it broke. Nothing is truncated to fit.

Which fields may be left out, all of them:

- `bet.md`: `premises`, `facing`, `deferred`.
- `<slice>.md`: `facing`, `records`, `data`.

Every other field in the tables below is required. That includes every field of a `ladder` entry, a milestone, a slice entry, a facing item, a deferral, a proof, and the `data` block. `program.md` has no optional field at all.

Required is not the same as holding something. `fixtures`, `real` and `faked` must be written, and may be written `[]`. `design`, `ladder`, `milestones`, `slices` and `proofs` must be written and must hold at least one entry.

A field with no reader is not written at all. When a later slice starts reading something new, that slice adds the field and this section names it.

### 1.2 Ids

An id is lowercase letters, digits and underscores. It names one thing in the whole repo: no two units, milestones, facing items or proofs may wear the same id. The space is flat and repo-wide — one space, not one per shape — because a reference names an id and nothing else.

A ladder entry naming a bet that has files is a reference to that bet, not a second declaration of its id. A ladder entry naming a bet nobody has cut yet is the only place that id is written down, so it holds the id against everything else.

Row ids (D28) use dashes instead. That is deliberate. A proof id has to sit inside a Go test name, and a row id never does, so neither charset admits the other's separator and the two can never read as one spelling.

### 1.3 `program.md`

| Field | Shape | What it is |
|---|---|---|
| `id` | id | The program's id. Matches its directory. |
| `title` | text | What the program is called. |
| `goal` | text | What it is for. |
| `done` | text | One falsifiable line. |
| `ladder` | list of blocks | The bets, in order. At least one. |

Each `ladder` entry holds:

| Field | Shape | What it is |
|---|---|---|
| `id` | id | The bet's id. |
| `line` | text | One line saying what the bet delivers. |
| `proof_sketch` | text | One line saying what would prove it. |

A ladder entry does not have to have files. Only the next bet is designed in full; the rest stay at one line and a sketch until they are next. A bet that does have files must appear on its program's ladder.

A bet sits at one place on one ladder. Listing it twice on one ladder is refused, and so is naming it on the ladders of two programs.

### 1.4 `bet.md`

| Field | Shape | What it is |
|---|---|---|
| `id` | id | The bet's id. Matches its directory. |
| `title` | text | What the bet is called. |
| `program` | id | The program it belongs to. Must be the program whose directory it sits under. |
| `design` | list of paths | The design docs, from the repo root. At least one, and each must be a file that exists. |
| `milestones` | list of blocks | The milestones, in order. At least one. Each holds `id` and `title`. |
| `slices` | list of blocks | The slices, in order. At least one. Each holds `id` and the `milestone` it sits on. |
| `facing` | list of blocks | Each user-visible thing the design names. Each holds `id` and one `line`. |
| `deferred` | list of blocks | Facing items this bet does not deliver. Each holds the facing `id` and a `reason`. |
| `premises` | list of ids | The sealed artifacts this bet stands on. |

A milestone is a section of the bet file, not a file of its own. Its only machine-read content is its order and the slices on it.

Every slice the `slices` list names must have a file in the same directory, and every slice file in that directory must be on the list. A slice listed twice is refused.

### 1.5 `<slice>.md`, the proof plan

| Field | Shape | What it is |
|---|---|---|
| `id` | id | The slice's id. Matches its file name. |
| `bet` | id | The bet it belongs to. Must be the bet whose directory it sits in. |
| `milestone` | id | The milestone it sits on. Must be one its bet holds, and must agree with the bet's own list. |
| `proofs` | list of blocks | What this slice proves. At least one. |
| `fixtures` | list of text | The axes that must vary. |
| `real` | list of text | What runs real. |
| `faked` | list of text | What does not. |
| `facing` | list of ids | The facing items this slice claims. Each must be one its bet declares. |
| `records` | list of paths | The records this slice owes. |
| `data` | block | Written when the slice touches data, and left out when it does not. |

`fixtures`, `real` and `faked` must be written, and may be written `[]`. Saying nothing is faked is a claim; leaving the field out is silence.

The `data` block's own presence is the declaration (D45). A slice that writes it says it touches data and owes all three entries below. A slice that leaves it out says it does not. There is no separate boolean, because two ways to say one thing is two things to keep in step.

Each `proofs` entry holds:

| Field | Shape | What it is |
|---|---|---|
| `id` | id | The proof's id. |
| `marker` | text | The test's name. |
| `from` | text | The design anchor the proof comes from: a path from the repo root, one `#`, and an anchor. The file must exist. A second `#` is refused. |
| `headline` | true or false | Whether the board shows it. |
| `retire_at_close` | true or false | Whether it is a deliberate exception that goes at bet close. |

A marker is `TestProof_<proof id>_<readable words>`. The proof id is spelled inside the test name, so the plan file and the test carry one spelling of it and `go test -run` can filter on it.

One test name answers for one proof. Two proofs may not name one marker. And no proof id may open with another proof id and an underscore: the test name `TestProof_a_b_runs` opens with the marker prefix of the proof `a` and with that of the proof `a_b`, so one result would land in two places.

The `data` block holds:

| Field | Shape | What it is |
|---|---|---|
| `reversibility` | text | How the change is undone. |
| `runtime_class` | text | How long the proof runs. |
| `fixture_provenance` | text | Where the fixture came from. |

### 1.6 What the tools do with this

`groundwork verify` runs a `plan` row. It is red when a plan file will not parse, when an id repeats, or when a reference reaches nothing.

The row's red line opens with the count of the problems found, and then the first of them. The count leads because the line is cut from the end (D33): words give way, and the count never does.

A repo with no `docs/plan` directory is green: it states no plan, so it can misstate none. A `docs/plan` directory that is there and holds no `program.md` is unrunnable, not green — a check that passes on nothing is not a check — and the line names what the directory held instead.

Nothing in this section says whether work is done. Landed-ness is read from git, and red-or-green is read from the test run. Both arrive in later slices of bet 3.

---

## 2. The seal tag

A seal is an annotated git tag. Its name is `seal/<kind>/<subject-id>`.

The kind is one of four, and the list is closed: `design`, `acceptance`, `birth`, `adoption`. The subject id is an id, spelled the way section 1.2 spells one: lowercase letters, digits and underscores, at most 64 bytes.

A lightweight tag under `seal/` is not a seal. A seal says what it covers, and only an annotated tag has a message to say it in.

### 2.1 The message

The message is exactly this shape, and nothing else parses:

```
seal: design b3s3

covers:
  1122334455667788990011223344556677889900 docs/plan/rebuild/bet_3/b3s3.md
  8f3a1c00d4e5b6a7980112233445566778899aab docs/spec/proof.md

Battery: 8.0+rb43026c
Battery-Run: run-20260826T120000Z-abcd
```

The rules, all of them:

- The first line is `seal:`, one space, the kind, one space, the subject id. Nothing after the subject.
- The second line is blank.
- The third line is `covers:`.
- Then one covered line per path: two spaces, the path's blob hash at the sealed commit, one space, the path from the repo root. At least one.
- The covered lines are sorted by path, and no path appears twice. The order is part of the bytes, and the bytes are the tag's object id — so two grants over the same set produce one tag.
- Then a blank line.
- Then two trailers, in this order: `Battery:` and `Battery-Run:`. Nothing after them.

A blob hash is forty lowercase hex digits.

`Battery:` carries the version pair D23 fixes: a declared MAJOR.MINOR, a plus, and the seven-hex digest with its leading `r` — `8.0+rb43026c`. `Battery-Run:` carries the run id of the battery run the seal was granted on, which is `run-<8 digits>T<6 digits>Z-<4 hex>` — `run-20260826T120000Z-abcd`.

A covered path is written plainly: letters, digits, dots, dashes, underscores and slashes, starting with a letter, a digit or a dot. No segment may be empty, `.` or `..`. That is tighter than what git will store, on purpose — the path is handed straight back to git as a pathspec, and a leading colon, a glob or a leading dash would turn one path into a different question.

And the caps, all of them:

- A whole message: 65536 bytes.
- One covered path: 300 bytes.
- A subject id: 64 bytes.

Composition is a longer covers list, never a second tag. On the complex lane the design seal covers the design docs and the slice proof plans together, in one tag.

### 2.2 The signature

A signature is checked against a committed allowed-signers file at `.groundwork/allowed-signers`, in git's SSH allowed-signers format. It is committed so a fresh clone can verify with no keyring setup.

A seal has four states, and only the first is a person's authority:

| State | What it is |
|---|---|
| verified | A good signature by a key the allowed-signers file lists. |
| unsigned | The tag carries no signature. |
| unverified | The tag carries a signature, and it did not check out. |
| missing | There is no such tag. |

Missing is red. Unsigned and unverified are printed loudly and never count as human authority. In bet 3 they are loud and not blocking: there is no key in this environment that the agents cannot read, so a blocking rule would either put the key inside their reach or stop every run. When the owner's key signs seals, unsigned becomes blocking, and that flip is a major battery bump.

The tool never holds or creates a signing key. It only verifies. Every seal it grants is unsigned, and every line it prints about one says so.

### 2.3 The mirror

The host's git proxy refuses pushes outside `refs/heads`, so a seal tag cannot travel as a tag. Each tag's raw object bytes are mirrored on the branch `groundwork-seals`:

```
tags/seal/design/b3s3          the tag object's own bytes
prior/seal/design/b3s3/<oid>   a tag an amendment replaced
index.txt                      one line of "<oid> <tag>" per mirrored tag
```

One file per tag under `tags/`, one file per replaced tag under `prior/`, and one listing at `index.txt`.

`groundwork seal restore` hands the bytes under `tags/` back to `git hash-object -t tag -w` and points the ref at what comes out. A tag object's id is the hash of its own bytes, so the same id comes back and an owner's signature survives the round trip byte for byte.

A name already taken by a different object is never overwritten, and a file whose bytes name a different tag than the file it sits under is refused. A file under `tags/` that is not a seal tag's name is skipped and reported: the branch is pushable on purpose, so one scribbled file must never stop the other tags from coming back.

The branch is a mirror, not a second record. The tag stays the thing the tools read.

One limit is recorded here rather than fixed. Anyone who can push to the branch can invent a whole seal on it — a well-formed tag object under a well-formed name — and a restore will rehydrate it and `seal verify` will call it sound. Nothing in the mechanism can tell an invented seal from a real one, because only a signature by a key outside the agents' reach can bind a seal to its author, and that is the flip R4 already defers. Until then the mirror is watched, not trusted: what it holds is visible in git, and a seal nobody signed is no one's authority wherever it came from.

### 2.4 The journal's seal line

A seal line carries `seal_kind`, `tag`, `target` and `action` (D8), and five more fields this section adds:

| Field | Shape | What it is |
|---|---|---|
| `battery` | text | The version pair the seal was granted under. Written with `battery_run` or not at all. |
| `battery_run` | text | The run id that pair came from. Written with `battery` or not at all. |
| `reason` | text | Why the seal moved. Both lines an amendment writes carry it, revoked and granted alike. A first grant moves nothing and leaves it off. |
| `signature` | text | What state the tag's signature was in when the line was written: one of the four in 2.2. |
| `signer` | text | Who git named. Written only when the signature verified, and never without `signature` beside it. |

`signature` and `signer` are R6's other half — the record states who signed — recorded rather than printed, which is the same reason `reason` is here.

`battery` and `battery_run` are D23's second recording place, and D28 deferred them to this slice. They are read from the journal's own newest battery run, never from the caller, so a seal cannot name a version that never ran. That run has to be green: a seal is a claim that the work stands.

### 2.5 What the tools do with this

`groundwork seal grant` writes the tag, the mirror blob and the journal line. `groundwork seal amend` prints the before and the after, refuses without a reason, moves the tag, files the tag it replaced under `prior/`, and writes two journal lines — revoked, then granted, per D13. `groundwork seal restore` rehydrates the tags. `groundwork seal verify` checks them.

`groundwork verify` runs a `seal-verify` row. It recomputes each covered path's blob hash at HEAD. It is red when a covered path moved or went missing, when a tag under `seal/` does not read as a seal, when a tag's name disagrees with the kind and subject in its own message, or when a tag's battery trailers disagree with its own seal line.

A repo with no seal tag is green: it states no seal, so it can misstate none. The line says only that, and never claims a seal was checked.

---

## 3. Test naming and the `Slice` trailer

The board is a derivation. It is never a file anyone edits, and no tool writes one. It is read from three things and nothing else:

1. The plan — which proofs exist, and which milestone each sits on (section 1).
2. Git — which slices have landed, read from a `Slice:` trailer on commits.
3. The stack adapter's per-test run results — which proofs are red and green.

Two shapes join those three. A marker joins a proof to its test. A trailer joins a slice to its commit. Both are written below.

### 3.1 The marker

A proof's test is named:

```
TestProof_<proof id>_<readable words>
```

The proof id is spelled inside the test name, so the plan file and the test carry one spelling of it. Nothing else has to be kept in step, and `go test -run` can select the proofs by name.

The whole name is the join. A result reaches a proof when the test's name is the marker exactly — not when it merely opens with it. Section 1.5 says why: the test name `TestProof_a_b_runs` opens with the marker prefix of the proof `a` and with that of the proof `a_b`, and a join on a prefix would land one result in two places.

The words after the id are for a reader and no parser reads them. A marker is a Go test name, so it holds letters, digits and underscores.

The board runs the tests the plan's markers name, and no others. It builds one pattern out of every marker the plan declares and hands it to the runner. A bet's own filter is the same mechanism by hand: `go test ./... -run 'Proof_b3'`.

One plan can outgrow that. A pattern longer than 8192 bytes would not fit on a command line, so a plan that large falls back to `^TestProof_` and runs every test whose name opens with the marker prefix. That runs a few tests too many, which is a board with extra results on it; a run that could not start is no board at all. Nothing else changes: a result still reaches a proof only on the whole marker.

This is the Go path. Another stack declares its marker convention through the adapter seam and lands it with that stack's adapter bet. A stack that declares none is run whole and its results filtered afterwards, which is slower and just as true.

### 3.2 The `Slice` trailer

A slice's commit carries a third trailer beside the two the working agreement already asks for:

```
Bet: <bet name>
Tests: <what proves it>
Slice: <slice id>
```

The trailer is read with git's own trailer parser, so a `Slice:` line that git does not read as a trailer is not one here either, and a folded value is joined onto one line before it is read.

The value is an id, spelled the way section 1.2 spells one: lowercase letters, digits and underscores, at most 64 bytes. It names a slice the plan declares.

One slice is one commit. That single sentence decides every shape below.

| What git found | What the board does | Is it red |
|---|---|---|
| One `Slice:` trailer naming a slice the plan declares | The slice has landed | no |
| A trailer on a commit with more than one parent | Not read, and named | no |
| A trailer naming a slice an earlier commit already landed | The slice has landed, and the later commit is named | no |
| Two or more `Slice:` trailers on one commit | Nothing lands, and each is named | yes |
| A trailer with nothing after its colon | Nothing lands, and it is named | yes |
| A trailer whose value is not an id | Nothing lands, and it is named | yes |
| A trailer naming no slice the plan declares | Nothing lands, and it is named | yes |

History lands a thing once and what comes after is commentary, so when two commits claim one slice the oldest claim is the landing and every newer claim is a stray. The stray is what gets named: a reader sent to the landing commit would be sent to the wrong one.

A merge commit is not red because it misstates nothing: it is a claim in a place the board does not read. A merge is not a slice's commit, and merges never govern here for the same reason they never govern a waiver.

The other four are red because they are misstatements in the one input landed-ness is read from. Nothing else in this tool reads these trailers, so a board that only whispered would be the only reader of a lying input.

Every value the board prints from a trailer is made printable and cut to 64 bytes first. A commit message is free text, and a value carrying a newline would otherwise draw a row of its own in the table it is printed in. On a line too narrow for the whole of one, the value gives way and the reason stays: a reader can fetch the value from the commit the line names, and the reason is the line's own contribution.

A squash erases every `Slice:` trailer the commits behind it carried. The history-shape check that refuses one lands with the record row.

### 3.3 Expected state

Expected state comes from plan position, and from nothing anybody wrote down.

A proof on a milestone that still holds unlanded slices is expected red. A proof on a milestone whose every slice has landed is expected green. The milestone is the unit rather than the slice, because a milestone is what a bet promises and a slice is how it gets there.

What the run says is one of four: the test passed, failed, was skipped, or never ran. Only the first is green. The other three are kept apart rather than folded together, because the stub check judges the reds and cannot judge what it cannot tell apart.

The two ways expected and actual disagree are not the same thing:

| Expected | Actual | What it is | Is it red |
|---|---|---|---|
| red | passed | The plan lagging the work: green ahead of plan | no |
| green | anything but passed | Work regressing: red behind its plan | yes |

Green ahead of plan is the ordinary state of every slice between the moment its test goes green and the moment its commit lands, and of every repo whose history predates this trailer. It is counted, named and shown — never silently accepted, and never red, because a red there would fire on every honest slice in progress.

### 3.4 Red for the right reason

Expected red is not the whole answer. A proof the plan expects red has to be red for a reason, and the reason has to be an assertion that judged something and said no.

The `stub` row reads the same board the `board` row derives, judges the proofs that board expects red, and asks of each what became of it.

| What the run said about a proof expected red | What it is | Is it red |
|---|---|---|
| It failed at an assertion | Red for the right reason | no |
| It failed, and its test cannot fail | A red that proves nothing | yes |
| It passed, and its test cannot fail | A stub: the test was never able to fail | yes |
| It passed, and its test can fail | Green ahead of plan | no |
| It was skipped | A test that did not run | yes |
| No test of it ran, every surface ran, and its slice has landed | A slice that landed without its proof | yes |
| No test of it ran, and its slice has not landed | Work the plan has not reached | no |
| No test of it ran, and a surface did not run | A proof the run never reached | no |

"Its test cannot fail" is the honesty scan's own judgment, not a second one. The scan reads the test's source and names five shapes: a body that asserts nothing, an assertion commented out, a test that only logs, an assertion under a condition that compares a value to itself, and a test that skips itself unconditionally. The three stub styles the ladder names — an empty body, a commented-out assertion, an always-true assertion — are among those five, and the row prints the scan's words whole.

What the scan cannot follow reads as a test that can fail: a helper in another file, an assertion library, a handle passed to something it cannot see. That is the scan's own stance, precision over recall, and it is where this row's reach ends. So the row's own line says what the scan found and never that a repo holds no stub.

Those are the four states section 3.3 closes the run's vocabulary to. A fifth, added to the board without a ruling behind it, is named rather than read as one of the four: what this row cannot read never passes in silence.

Green ahead of plan stays what section 3.3 makes it: counted, never red. A test that can fail and passes anyway is the plan lagging the work, and a row that reddened on it would fire on every honest slice in progress. The proofs themselves are named on the board row's line, which is the row whose subject they are.

A surface that did not build, or whose test binary died before it finished, turns the row red with the surface named. A proof that cannot compile proves nothing, and one whose runner died never reached anybody's assertion. Both are reported for a whole run rather than for one test, because the stack loses its log when the build breaks or the binary dies, so the surface is what the row can honestly name.

A broken surface never stops the row reading the rest. The stubs on every surface that did run are still counted and still named beside it, and a surface that broke for a reason the row cannot name rides as a clause and reddens nothing. While any surface has gone unrun, a proof with no result is never blamed for it: the missing result may be the surface. The cost is stated plainly: a slice that landed without its proof passes this row while any surface is unreachable, because the row cannot tell that absence from the surface's. The clause naming the unrun surface is what keeps the state visible.

A repo with no `docs/plan` directory is green: it expects no proof red, so there is none to judge. A plan whose every milestone has landed is green for the same reason — and whether those proofs are green is the board row's question. That answer comes before the surfaces, because expected state comes from plan position and nothing a run did can move it.

Everything the row could not reach is unrunnable, on the board row's own rule: a red built out of missing data is not a red.

### 3.5 What the tools do with this

`groundwork board` renders the board, stamped with the run it came from: when the run happened, what it cost, how many results it read, and the commit the landed set was read at. It writes nothing.

`groundwork verify` runs a `board` row. It is red when a proof its plan expects green is not green, or when a `Slice:` trailer misstates landed-ness. The row writes nothing either, and its own line opens with the counts, because the line is cut from the end (D33). Trailers that misstate and trailers the board declined to read are counted apart there: one number covering both could not tell a red cause from a benign one.

A repo with no `docs/plan` directory is green. A board is derived from a plan, and where there is none there is no board — nothing was reconciled, so nothing can have been misstated.

Everything the row could not reach is unrunnable, never green and never red: a plan that will not read, a plan naming no proof at all, a manifest it cannot load, a history git would not give it, and a surface whose own run broke. That last one matters most: a run that broke says nothing about what passed, so every proof would read as never run, and a red built out of missing data is not a red. A surface written in a stack no adapter maps is one of those: D25's fail-closed red for an unmapped stack is the manifest row's, and one cause draws one red.

A shallow clone is not unrunnable. It is read, and the board says the history was short. History a clone cannot see can only leave a slice unlanded, which moves a proof toward expected red — the flagged direction, never a silent pass over a regression.

`groundwork verify` also runs a `stub` row, beside the board row and off the same derivation. It is red when a proof the plan expects red is not red for the right reason, and when a surface did not build or died before its tests finished. Its line opens with the counts too, and it says what the honesty scan found rather than what is true of the repo — the scan is written to miss rather than to guess, and a line claiming more than that would be claiming the scan's blind spots as clean ground.

---

## 4. Two-direction traceability and premises

Section 1 says what a plan file holds. This section says what the plan has to reach: the design it came from, and every user-visible thing that design names.

Two directions, and a signal beside them.

**Backward.** Every proof carries `from: <design-path>#<anchor>`. The path and the shape are section 1's; the anchor is this section's. It has to name a heading somebody wrote in that file.

**Forward.** Every id in a bet's `facing` list is claimed by exactly one of that bet's slices, or listed under `deferred` with a reason.

**Premises.** A bet's `premises` are the ids of sealed artifacts it stands on. Amending or withdrawing one of those marks every bet whose premises name it.

### 4.1 What an anchor is

An anchor is the heading slug a markdown renderer makes, which is what somebody clicking a heading link in a browser gets. The rule, applied to the heading's text:

- Lowercase it.
- Drop everything that is not a letter, a digit, a dash or an underscore.
- Turn each space into a dash.

Nothing is collapsed. An em dash between two spaces leaves two dashes behind, because the dash it sits between is dropped and the two spaces are not.

| Heading | Anchor |
|---|---|
| `## R1 — The first ruling (B7)` | `r1--the-first-ruling-b7` |
| ``### 1.1 `program.md` `` | `11-programmd` |

A link in a heading contributes its words and not its target: `[Two-direction traceability](../spec/loop.md)` slugs as `two-direction-traceability`, because a renderer builds the anchor from the text it shows.

Inline links only, and the two limits are worth naming. A reference-style link and an image are not read, so a heading holding one makes an anchor this cannot resolve. And the stripping runs inside a code span too, where a renderer would leave the brackets alone: a heading reading ``## The `[a](b)` form`` slugs as `the-a-form` here and `the-ab-form` on GitHub. Both are narrow, and both fail the same way — an anchor nobody can resolve, named on the row's line — which is the direction to be wrong in.

The second heading of one name takes a `-1`, the third a `-2`, and so on.

A heading is an ATX heading: one to six `#`s, then a space. A `#` inside a fenced code block is somebody showing markdown, and it makes no anchor. An underlined heading — text with `===` or `---` beneath it — is not read. A design file that uses one has anchors this cannot resolve, and the honest answer is to write the heading with `#`s.

The design file is read as it sits in the working tree, the same read the plan reader gives the plan it is being held against. R15 moves committed-content reads onto the seal machinery in a later slice, and half of that here would leave one row reading two repos at once.

Three things are refused before a byte is read, and each is a dangling anchor with its reason named:

- A file over 262144 bytes, which is 256 KiB. A design doc is prose, and prose that long is a mistake or an attack; an uncapped read is one committed file away from taking the whole battery down. The cap is on the read, not on the size the file claims, because a stat can be out of date the moment it returns.
- A file that is a symlink. The plan reader keeps the written path inside the repo, and a committed symlink sitting at such a path still points wherever it likes.
- A file whose resolved path leaves the repo: it `resolves outside this repo`, in the row's own words. Refusing the last element is not enough — a symlink at any directory along the way walks the read out just as surely — so the whole path is resolved and held inside the resolved root.
- Anything that is not a regular file. A read of a named pipe never returns.

### 4.2 What a claim is

A slice claims a facing id by naming it in its own `facing` list. The claim is for the bet whose directory the slice sits in. A slice elsewhere naming the same id is a reference the `plan` row already refuses, and it is not read as a claim here.

R12 says a facing id is claimed by exactly one slice's proof. The slice's facing list is the claiming unit, because a proof carries no facing field and the slice is the unit that lands (D61 ruling 2).

A slice that lists one facing id twice is refused by the `plan` row, at load, like every other doubled declaration. It never reaches this row.

A deferral is a claim too: it is the bet saying it does not deliver the item in this bet. So an id both claimed by a slice and listed under `deferred` is two answers to one question, and it reads as claimed twice.

### 4.3 What the record says about an artifact

An artifact a `premises` entry names is a seal subject: the `<subject-id>` half of a `seal/<kind>/<subject-id>` tag, spelled the way section 2 spells one.

What the journal's seal lines say about that tag is what the row reads:

- A `revoked` line with a `granted` line after it is an amendment. The artifact moved.
- A `revoked` line with nothing granted after it is a withdrawal. That is where a dying amendment lands too.
- No `revoked` line at all is a seal that stands.
- No seal of that subject at all is the unsealed state.

R13 says an amendment marks every later bet whose premises name the artifact. The mark falls on every bet whose premises name it — closed bets included, and across programs (D61 ruling 1). Later is satisfied by construction: a premise is a sealed artifact, so a bet citing one came after it. And a closed bet standing on a premise that moved is exactly what the signal exists to surface.

A mark does not clear. The record holds the amendment, so a bet that stood on the moved artifact keeps its mark until somebody rules on what clears one. Re-reading a bet against an artifact that moved under it is a person's work, and this bet builds no mechanism for a bet to answer.

### 4.4 What the tools do with this

`groundwork verify` runs a `trace` row.

| What the row read | What it is | Is it red |
|---|---|---|
| The anchor names a heading in the file | Traced | no |
| The anchor names no heading in the file | A proof pointing at nothing | yes |
| The design file could not be read | An anchor nobody could resolve | yes |
| No seal covers the design file | Unsealed, and loud | no |
| A facing id one slice claims | Claimed once | no |
| A facing id no slice claims and no deferral records | Unclaimed and unrecorded | yes |
| A facing id two slices claim | Claimed twice | yes |
| A facing id one slice claims and the bet defers | Two answers to one question | yes |
| A facing id the bet defers with a reason | Recorded | no |
| A premise whose artifact the record says was amended | A bet standing on moved ground | no |
| A premise whose artifact the record says was withdrawn | A bet standing on moved ground | no |
| A premise in one program naming an artifact sealed under another | A bet standing on moved ground | no |
| A premise of the first bet on a ladder whose artifact moved | A bet standing on moved ground | no |
| A premise no seal names | Unsealed, and loud | no |

The row's line opens with the counts, because the line is cut from the end (D33): how many proofs and how many dangling anchors, how many facing ids and how many unclaimed and how many claimed twice, and how many bets are marked. Then the things it found, named one by one.

Nothing being sealed is loud and never blocking, which is R4's ground. There is no key in this environment the agents cannot read, so a rule that blocked on a missing seal would either put the key inside their reach or stop every run. The head carries `(unsealed)` whenever a design file the row read carries no seal, or a premise names an artifact no seal names, and each unsealed thing is named beside the row's other findings. It is named rather than counted: a count of them would have to sit in the head to be worth anything, and the head is already full at its widest. The head says that something is unsealed; the names say which.

When the owner's key signs seals, that flips with R4's own flip, and the flip is a major battery bump.

A mark is loud and never red for a different reason: a bet has no way to answer one, and a red nobody can clear is friction, which is how a row ends up permanently waived.

A repo with no `docs/plan` directory is green. There is nothing to trace in either direction, so nothing can have been misstated, and the line claims no more than that.

Everything the row could not reach is unrunnable: a plan that will not read, a plan naming no proof, no facing item and no premise, and a git that would not answer. A plan that will not read is the `plan` row's red, and two rows red for one fault is two reds for one fix.

---

## 5. Records, grants counted, and the shape of the history

Section 1 says what a slice plan declares. This section says what the records it declares are held to, how a waived row is counted, what a squash leaves behind, and what a bet close runs.

**Records.** A slice plan declares `records`, a list of paths it owes. Each one has to be there, and none may be older than the work it describes.

**Grants counted.** A row waived too often stays red until a finding names it. The count comes from each waiver file's own git history.

**History shape.** A bet closes on a merge commit, never a squash, because a squash erases every `Slice` trailer the board reads.

**The close scope.** `verify --close` runs the rows a bet close runs. It is a list the tool checks, not a page of steps somebody works through.

### 5.1 What a record is, and when it is stale

A record is one path in a slice plan's `records` list. It is named from the repo root, in the shape section 1 gives a path.

Only declared records are judged. A row that invented obligations would be red about work nobody promised, and a red nobody agreed to is how a row ends up permanently waived.

Only landed slices are judged. A slice has landed when a commit reachable from HEAD carries its `Slice` trailer, which is section 3's rule. A slice that has not landed owes nothing yet. Its record is work in progress, and it is counted so that "0 missing" is never read as a claim about it.

Two words in "older than the work it describes" are fixed here.

The **slice's landing commit** is the oldest commit carrying that slice's `Slice` trailer, per D57 ruling 4: history lands a thing once, and what comes after is commentary. The claim is read through the `board` row's own machinery: the same four validity shapes, merges unread, strays named. So the two rows cannot disagree about one commit.

**Predates** is ancestry, not clock time. A record's last commit predates the slice's when it is an ancestor of it. Commit dates are writable and they run backwards on any history somebody rebased, so a comparison of dates would rest on a number anybody can choose. A commit is reachable from itself, so a record written in the slice's own commit does not predate it — which is how every slice of this bet has landed.

A record's own last commit is the most recent commit that changed it. D38 reads a waiver file the same way: what a file holds now is what its most recent commit put there.

The **never-committed** count is exactly that: a path git holds no commit for. A record edited since it landed is not counted there and is not red. Its committed copy is still current, and the count would mislead if it read as "every record's content is committed".

A slice this row found no claim for is not judged, and its records are not read at all. In a whole clone that means the slice has not landed, and the count reads **waiting**. In a shallow one the tool cannot tell that from a landing past the edge, so the count reads **unseen** and claims the weaker thing (D64 ruling 2). The row's green covers the records it read and no others.

A declared path may be declared once. A slice naming one record twice is refused when the plan loads, beside every other doubled declaration.

### 5.2 How a grant is counted

A grant is one commit that changed one waiver file. The waiver's shape is D24's, and the directory is `.groundwork/waivers`.

A rewrite in a commit of its own is a re-grant, and it is another grant for this count. Three re-grants of one file is a row three people in a row decided to keep waived, and that is the thing the count is for.

A merge is not a granting act. It is counted, named, and never read as a grant — the same rule the waiver authority already applies to the same directory.

The bet a grant landed in is the `Bet` trailer on its commit. It is held to the four validity shapes the board holds a `Slice` trailer to, against the bets the plan declares. A grant whose attribution fails any of them pools into one **unattributed bucket**, and that bucket shares the per-bet limit (D64 ruling 5). A misstated attribution can only ever tighten a threshold, never buy room inside one: three grants under three invented bet names are three grants in one bucket.

A repo with no plan declares no bet, so every attribution there pools. That is the same rule, not an exception to it.

The read follows renames. A waiver moved with `git mv` is the same waiver, and a count that restarted at the rename would let a rename buy a fresh threshold. Only a rename joins two names. git also reports a copy, where a new file was made out of an old one that is still there. Folding those together would count one waiver's grants against another that merely looks like it.

**A pure rename is not a grant.** It changes nothing about the waiver, so it is counted and named and never read as one (D65 ruling 2). Two honest grants plus a tidy-up move are two grants. A move that also edited the file carries a lower similarity score and is a re-grant like any other rewrite.

**A waiver's history starts at the commit that made it.** A path reused after a deletion is a new file, and a dead file's grants die with it (D65 ruling 1). Otherwise a new waiver could arrive at an old path already over a limit, red on a row that never had those grants. The boundary is the newest commit that added the file, rather than the one that first gave the path a file.

Two thresholds, from D37 ruling 2 and D24: 3 grants of one row inside one bet, or 5 grants of one row across the repo. At or over either, that row stays red **until a finding names it**.

A finding names a row when an entry title in `docs/findings.md` carries the phrase `<id> row` (D64 ruling 4). The title, because a title is short and somebody chose every word in it. The phrase, because nine of the sixteen row ids are ordinary English words. A bare-word match cleared the `record` row's threshold with an entry about a spend query, so the threshold could never bite. The phrase is matched at word edges, by the same rule that decides whether a decision is named from a defect class.

A repo with no findings ledger names nothing. That is the safe direction: an over-waived row stays red rather than being cleared by a file nobody wrote.

One limit, named rather than left implied. The count is over the waiver files the directory holds now, because R14 counts each waiver file's own git history. A waiver deleted after it expired takes its grants out of the count with it.

### 5.3 What a squash leaves behind

git writes a squashed merge as one single-parent commit whose message quotes every message it swallowed, indented. The `Slice` lines are still in that message, and git's own trailer parser returns none of them, because a trailer is read from the last paragraph of a message and a quoted block is not it.

So the readable fingerprint is a gap: a commit whose message quotes more `Slice` lines than git's trailer parser reads on it. A `Slice` line is the key, a colon, then the value, with any leading whitespace trimmed — git indents everything it quotes.

A quoted line counts only inside a **cluster**: 2 or more trailer-shaped lines next to each other (D64 ruling 7). That is the shape a squash quotes, because it quotes a whole trailer block. A lone `Slice:` line in a paragraph of prose is somebody writing about a slice. This repo's own ledger commits write exactly that. Reading it as a squash was a red nothing could ever clear.

The check is wider than squashes by one step, on purpose. A commit that buried a whole trailer block under a later paragraph has the same fault. The board cannot read it, so the slice it names is not landed as far as anything here can tell.

**One flavour is invisible. This is the limit, not a gap somebody will close.** A squash whose message drops the quoted trailers leaves no evidence at all. A GitHub squash-merge with a cleaned title is that shape. Nothing tells it from an ordinary commit, and R4's seals are the eventual answer. Until then this check catches the squash that quotes, and misses the squash that does not.

A message longer than 65536 bytes is read only in part, and the row counts how many it read that way rather than judging the half it saw.

A merge's message is not read at all. A merge that quotes its branch's messages is a merge doing its job, and reading it would be red on every repo that has `merge.log` set.

### 5.4 The close scope

`verify --close` runs the bet-close scope. Two halves.

The **full suite** is every row this battery holds. Per-slice scoping of the suites a row runs is a thing the spec asks for and nothing has built. So every row already runs at every verify, and a close is no exception.

The **close-scope list** is the rows that carry a bet-level question: `seal-verify`, `board`, `trace`, `record`. A close fails unless every one of them came back green or waived (D64 ruling 1). A row that went red, could not run, or never ran at all fails it. A close is a claim that what a close checks ran and held. Asking only whether the rows were registered reported a close over three unrunnable rows. Waived counts, because a waiver is a person's committed claim and D24 rules what that is worth. Later bets add their rows to the same list.

A close records its scope on the run's own line in the journal. A close is a property of a run, not a second event beside it.

The project's own test suite is not in this scope. A green battery does not prove the tests pass: the `run-evidence` row reconciles which tests ran, not how they ended. D55 makes running `go test` beside verify a line on the driver's landing checklist, until the row that asks the suite's own question lands. Naming it here would be this scope claiming a check nobody built.

### 5.5 What the tools do with this

`groundwork verify` runs a `record` row.

| What the record row read | What it is | Is it red |
|---|---|---|
| A declared record in the tree, newer than the slice's commit | Current | no |
| A declared record written in the slice's own commit | Current | no |
| A declared record that is not a file in the tree | A record nobody wrote | yes |
| A declared record no commit in a whole clone holds | A record nobody committed | yes |
| A declared record edited since it landed | Its committed copy is current | no |
| A declared record whose last commit the slice's commit comes after | Older than the work it describes | yes |
| A declared record of a slice that has not landed | Not owed yet | no |
| A declared record of a slice whose landing is past the shallow edge | Unseen, and not judged | no |
| A declared record dated to the edge of a shallow clone | Unjudged rather than believed | no |
| A slice that declares no record | Nothing to owe | no |

It runs a `waiver-count` row.

| What the waiver counter read | What it is | Is it red |
|---|---|---|
| Two grants of a row in one bet, four across the repo | Under both limits | no |
| Three grants of one row inside one bet | At the bet's limit, and no finding names it | yes |
| Five grants of one row across the repo | At the repo's limit, and no finding names it | yes |
| Three grants of one row whose title carries the phrase | At a limit, and answered | no |
| Three grants of one row a title names by bare word | At a limit, and unanswered | yes |
| Three grants under three bet names nobody declared | Three in the unattributed bucket | yes |
| Two grants of one row, then a tidy-up git mv | A move decides nothing | no |
| A new waiver at a dead waiver's path | A new file, with no inherited grants | no |
| A merge that changed a waiver file | Not a granting act | no |
| A file in the waiver directory that is not a waiver | Naming no row, so nobody's grant | no |
| A repo that waives nothing, whole history present | A real zero | no |

And it runs a `history` row.

| What the history row read | What it is | Is it red |
|---|---|---|
| A bet closed on a merge commit | Every trailer still readable | no |
| A bet closed on a squash | Trailers the board can no longer read | yes |
| A merge commit quoting its branch's messages | A merge doing its job | no |
| A lone quoted Slice line in a paragraph of prose | Somebody writing about a slice | no |
| A squash whose message kept no quoted trailers | Invisible, and named as the limit | no |
| A history naming no slice at all | Nothing to erase | no |

Each row's line opens with its counts, because the line is cut from the end (D33), and every count is in the head where no cut reaches it.

The `record` row's counts are the records read, then how many are missing, never committed, stale and unjudged, then how many slices are waiting or unseen. The three reds are apart because they are three different fixes.

The `waiver-count` row's counts are the waiver files read, how many were not waivers, the grants counted, the merges it did not read, the rows at a threshold, and the grants misstated. Each row at a threshold says on its own line whether a finding answers it. The rows no finding answers lead the line (D64 ruling 8).

The `history` row's counts are the commits read, the merges it did not read, the commits that swallowed a trailer, and the messages it read only in part.

**Three rows meet a shallow clone and answer differently. This is where that is written down.**

The `waiver-count` row is **unrunnable** on one, and never counts zero. Its verdict is a threshold over a count of every grant. A history it cannot all see makes that count wrong rather than narrow, and wrong toward the pass, because grants nobody can see read as zero. The line says so and says what to do about it.

The `record` and `history` rows **name the short history and keep judging**. That is the `board` row's posture, ruled in D56 ruling 3, for the `board` row's reason: what they cannot see leaves things unjudged rather than misjudged.

One case had to be closed before that was true of the `record` row. git dates every file in a shallow clone whether or not it can. At the edge the whole tree hangs off one grafted commit, so git reads that commit as having added every file. A record dated to the graft therefore has a real last commit out of reach, and believing the graft would call a record older than its work current. So a record dated to a parentless commit inside a shallow clone is left unjudged and counted. It is the same fact the waiver authority names about the same edge, and one function answers it for both.

The `history` row needs no such case. Every commit a clone holds carries its own real message and its own real trailers.

Everything else a row could not reach is unrunnable: a plan that will not read, a git that would not answer, a repo with no commit at all. A plan that will not read is the `plan` row's red, and two rows red for one fault is two reds for one fix.
