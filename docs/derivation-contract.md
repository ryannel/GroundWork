# The derivation contract

**Status:** live. Section 1 lands with bet 3 slice 1.
**Audience:** anyone writing a file the tools read, and anyone changing a tool that reads one.
**Scope:** the shapes GroundWork parses, and what it does with each one.

This page is the one place a parsed shape is written down. If a tool reads a file, a commit trailer, or a tag, the shape it reads is here. Every parser's test names the section it implements, so the page and the code ship in one commit.

Later slices append their own sections: the seal ceremony, test naming and commit trailers, and history shape. Later bets append theirs.

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
