# gw-drift-frontmatter-stamp — make code-coupled docs drift-checkable

`groundwork check` compares each code-coupled doc's `last_reviewed` date against the
git history of its `source_of_truth` paths. Docs written before drift tracking carry
no such frontmatter, so check reports them "unassessed" forever — staleness detection
is blind exactly where it matters.

## Detect

- **Applies** when any doc in the drift-tracked set — `docs/architecture.md`,
  `docs/services/*.md`, `docs/api/**/*.md`, `docs/domain/*.md` — lacks
  `last_reviewed` or `source_of_truth` frontmatter.
- **Already done** when every existing doc in that set carries both (plus
  `generation_mode`).
- **N/A** when none of those docs exist yet.

## Transform

Stamp each unassessed doc following the frontmatter contract the brownfield extract
skills define (see `.agents/groundwork/skills/groundwork-architecture-extract/` —
reference their stamping rules, do not restate them):

- `source_of_truth`: the code paths this doc actually describes — read the doc and
  verify the paths exist; never guess a glob.
- `generation_mode`: `extracted` for docs reverse-engineered from code, `authored`
  for hand-written ones, `generated` for generator output.
- `last_reviewed`: today's date **only after confirming the doc still matches the
  code it describes**. A doc that has drifted gets a review (route through
  `groundwork-update`) before it gets a stamp — stamping without reading would
  declare stale docs current and defeat the mechanism.

**Invariant:** a stamp asserts "reviewed against code as of this date." Never stamp
unread.

## Accept

- `groundwork check` reports zero "unassessed" docs in the drift-tracked set.
- Spot-checking any stamped doc shows `source_of_truth` paths that exist.
- One commit per reviewed batch, referencing `gw-drift-frontmatter-stamp`.
