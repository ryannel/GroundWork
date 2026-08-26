# The derivation contract

**Status:** live. Section 1 lands with bet 3 slice 1, section 2 with slice 3, section 3 with slice 4.
**Audience:** anyone writing a file the tools read, and anyone changing a tool that reads one.
**Scope:** the shapes GroundWork parses, and what it does with each one.

This page is the one place a parsed shape is written down. If a tool reads a file, a commit trailer, or a tag, the shape it reads is here. Every parser's test names the section it implements, so the page and the code ship in one commit.

Later slices append their own sections: history shape. Later bets append theirs.

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

### 3.4 What the tools do with this

`groundwork board` renders the board, stamped with the run it came from: when the run happened, what it cost, how many results it read, and the commit the landed set was read at. It writes nothing.

`groundwork verify` runs a `board` row. It is red when a proof its plan expects green is not green, or when a `Slice:` trailer misstates landed-ness. The row writes nothing either, and its own line opens with the counts, because the line is cut from the end (D33). Trailers that misstate and trailers the board declined to read are counted apart there: one number covering both could not tell a red cause from a benign one.

A repo with no `docs/plan` directory is green. A board is derived from a plan, and where there is none there is no board — nothing was reconciled, so nothing can have been misstated.

Everything the row could not reach is unrunnable, never green and never red: a plan that will not read, a plan naming no proof at all, a manifest it cannot load, a history git would not give it, and a surface whose own run broke. That last one matters most: a run that broke says nothing about what passed, so every proof would read as never run, and a red built out of missing data is not a red. A surface written in a stack no adapter maps is one of those: D25's fail-closed red for an unmapped stack is the manifest row's, and one cause draws one red.

A shallow clone is not unrunnable. It is read, and the board says the history was short. History a clone cannot see can only leave a slice unlanded, which moves a proof toward expected red — the flagged direction, never a silent pass over a regression.
