// Package battery runs the checks behind the groundwork verify command.
//
// A battery is an ordered list of rows. A row is one check: it has an id, a
// kind, a severity, and a function that returns one outcome with a line of
// evidence for it. A run executes every row, counts the outcomes, records the
// whole thing in the journal, and reports whether anything went red.
//
// The battery has a version, per D23: a declared MAJOR.MINOR that a person
// writes, plus a digest of the rows themselves. The declared half lives in a
// committed lock file at the repo root. The digest is computed from the rows
// at every run. When the two disagree the rows have moved without anyone
// saying so, and that is itself a red row — the one row this package ships.
//
// Only red fails a run. Waived, quarantined and unrunnable are counted and
// printed, and they never turn a run red. A run of zero rows is an error, not
// a pass: D17 rules that a verifier may never pass on nothing.
package battery

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/journal"
)

// Outcome is how one row came out.
type Outcome string

// The outcomes a row may report. Their strings are the journal's own closed
// vocabulary, and a test holds the two lists together.
const (
	// Green: the row checked what it checks, and found it sound.
	Green Outcome = "green"

	// Red: the row checked what it checks, and found it wrong.
	Red Outcome = "red"

	// Waived: a waiver stands over this row, so its verdict does not count.
	// A waiver never makes a row green; waived is its own outcome, printed
	// loudly. D24 rules the waiver machinery, which a later bet builds.
	Waived Outcome = "waived"

	// Quarantined: the row disagreed with itself across reruns, so it is
	// neither trusted green nor called red.
	Quarantined Outcome = "quarantined"

	// Unrunnable: the row could not reach the thing it checks. It is not a
	// skip — an unrunnable row is visible, counted, and someone's problem.
	Unrunnable Outcome = "unrunnable"
)

// Outcomes returns every outcome a row may report, in the order a run counts
// them. The journal holds the same list, and only one of the two is the
// original: see the test that compares them.
func Outcomes() []Outcome {
	out := make([]Outcome, 0, len(journal.BatteryOutcomes()))
	for _, name := range journal.BatteryOutcomes() {
		out = append(out, Outcome(name))
	}

	return out
}

// The severities a row may carry.
//
// Severity is recorded, printed, and folded into the digest, so changing a
// row's severity moves the battery version. It does not decide the run today:
// any red row fails the run, whatever its severity. A later bet that gives
// advisory a weaker meaning is making rows less strict, which D23 calls a
// major bump. Until then the shipped rows are all blocking.
const (
	Blocking = "blocking"
	Advisory = "advisory"
)

// severities is the closed vocabulary for a row's severity.
var severities = []string{Blocking, Advisory}

// kinds is the closed vocabulary for a row's kind. It is D26's verb list —
// honesty, wiring, token, divergence, reachability, flag, mutate, seal-verify,
// run-evidence — plus version and manifest, the two rows this bet's first two
// slices ship.
//
// manifest joins the list here rather than borrowing one of the nine. The
// capability manifest row is not any of those verbs, and filing it under the
// nearest one would misname it in every table and every journal line it ever
// writes. D28 recorded this list as closed, so widening it is a decision, and
// this comment is the note the driver rules on.
//
// The rows themselves land across several bets. Naming their kinds now costs
// nothing and catches a typo at registration, where a typo would otherwise
// ride into the digest and out to the lock file.
var kinds = []string{
	"version", "manifest",
	"honesty", "wiring", "token", "divergence", "reachability",
	"flag", "mutate", "seal-verify", "run-evidence",
}

// Kinds returns the kinds a row may carry.
func Kinds() []string {
	return slices.Clone(kinds)
}

// Severities returns the severities a row may carry.
func Severities() []string {
	return slices.Clone(severities)
}

// maxRowIDBytes caps a row id. Row ids go on journal lines and into output
// tables, and they are written by hand in this repo's own source.
const maxRowIDBytes = 40

// Result is what one check reports: how the row came out, and the row's own
// line saying why.
type Result struct {
	Outcome  Outcome
	Evidence string
}

// Context is what a check is handed when it runs.
type Context struct {
	// RepoDir is the directory the run was asked about. It may be anywhere
	// inside the repo, so a check that wants the root asks git for it.
	RepoDir string

	// Digest is the digest computed from this run's own rows. A check that
	// judges the battery version gets it here rather than recomputing it.
	Digest string
}

// Check is one row's work.
type Check func(Context) Result

// Row is one check in the battery.
type Row struct {
	// ID names the row. It is lowercase letters, digits and dashes: row ids
	// are printed in tables, typed into waivers, and fed to the digest, so
	// they stay to one spelling.
	ID string

	// Kind is one of Kinds. It says what family of check this is.
	Kind string

	// Severity is one of Severities.
	Severity string

	// Check does the work.
	Check Check
}

// Registry is the ordered list of rows one run executes.
//
// Order matters twice: a run reports rows in registration order, and the
// digest is computed over that order. Two batteries holding the same rows in
// different orders are different batteries.
//
// Register is the only way in, so it is the only way into the digest: a row it
// turns away is in no row list and in no version.
//
// The zero value works. NewRegistry reads better at a call site, but a caller
// that writes var reg Registry deserves this package's own words about the row
// it got wrong, not a nil map panic from inside here.
type Registry struct {
	rows []Row
	seen map[string]bool
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{}
}

// Register adds one row to the end of the registry.
//
// It panics on a row the battery cannot hold: a malformed id, a kind or
// severity outside its vocabulary, a missing check, or an id already
// registered. Every one of those is a mistake in this repo's own source, made
// before any check runs, and a battery that quietly dropped or overwrote a row
// would report on a set of checks nobody asked for.
func (r *Registry) Register(row Row) {
	if err := checkRow(row); err != nil {
		panic("groundwork: " + err.Error())
	}
	if r.seen[row.ID] {
		panic(fmt.Sprintf("groundwork: the battery already holds a row with the id %q", row.ID))
	}

	if r.seen == nil {
		r.seen = map[string]bool{}
	}
	r.seen[row.ID] = true
	r.rows = append(r.rows, row)
}

// Rows returns the registered rows, in registration order.
func (r *Registry) Rows() []Row {
	return slices.Clone(r.rows)
}

// Len returns how many rows are registered.
func (r *Registry) Len() int {
	return len(r.rows)
}

// Digest returns the digest of the row manifest: the letter r, then the first
// seven hex digits of the sha256 over the canonical row list.
//
// The canonical list is each row's id, kind and severity, each followed by a
// newline, in registration order. Those three fields are what a reader of the
// battery is promised; none of them can hold a newline, so the encoding cannot
// be made ambiguous by a row's own text.
//
// What a check does is deliberately outside the digest. The digest says which
// rows the battery holds, not what they concluded — a battery whose row went
// from green to red on the same repo has not changed version.
func (r *Registry) Digest() string {
	h := sha256.New()
	for _, row := range r.rows {
		fmt.Fprintf(h, "%s\n%s\n%s\n", row.ID, row.Kind, row.Severity)
	}

	return "r" + hex.EncodeToString(h.Sum(nil))[:digestBytes]
}

// RowResult is how one row came out in one run.
type RowResult struct {
	ID         string
	Kind       string
	Severity   string
	Outcome    Outcome
	Evidence   string
	DurationMS int
}

// RunResult is one whole run of the battery.
type RunResult struct {
	// ID names the run: run-<RFC3339-compact>-<4hex>.
	ID string

	// Version is the pair D23 describes, declared+digest. The declared half
	// reads "unknown" when the lock file could not be read — in which case
	// the version row is red and says so.
	Version string

	// Digest is the digest this run computed from its own rows.
	Digest string

	// Rows are the row results, in registration order.
	Rows []RowResult

	// Counts holds one count per outcome. Every outcome is present, even at
	// zero.
	Counts map[Outcome]int

	DurationMS int
}

// Red reports whether the run failed. Only a red row fails a run.
func (r RunResult) Red() bool {
	return r.Counts[Red] > 0
}

// Run executes every row of reg against the repo at repoDir and records the
// run in the journal.
//
// It refuses a registry with no rows. A run that checked nothing is a
// failure, not a pass — D17.
//
// Each row's line is journaled as soon as that row finishes, and the run's own
// line is written last. So a run cut short leaves the rows that did run on the
// record, and a journal holding a battery line holds every row line of that
// run. A journal that cannot be written fails the run: a check with no journal
// lines is a check that never ran, and a run nobody can find is not evidence.
func Run(repoDir string, reg *Registry) (RunResult, error) {
	if reg.Len() == 0 {
		return RunResult{}, fmt.Errorf("the battery has no rows to run, and a run of no rows is not a pass")
	}

	id, err := newRunID()
	if err != nil {
		return RunResult{}, err
	}

	digest := reg.Digest()

	// The declared half is read here only to label the run. Judging it is the
	// version row's job, and that row reads the lock file itself: a check
	// handed its own answer is not a check. A lock file this cannot read
	// leaves the label saying so, and the row turns red on the same file.
	declared := unknownVersion
	if lock, err := ReadLock(repoDir); err == nil {
		declared = lock.Version
	}

	res := RunResult{
		ID:      id,
		Version: VersionString(declared, digest),
		Digest:  digest,
		Counts:  map[Outcome]int{},
	}
	for _, outcome := range Outcomes() {
		res.Counts[outcome] = 0
	}

	start := time.Now()

	for _, row := range reg.Rows() {
		rowStart := time.Now()
		got := row.Check(Context{RepoDir: repoDir, Digest: digest})
		elapsed := int(time.Since(rowStart).Milliseconds())

		if !slices.Contains(Outcomes(), got.Outcome) {
			return RunResult{}, fmt.Errorf("the row %q reported the outcome %q, which is not one of: %s",
				row.ID, got.Outcome, strings.Join(journal.BatteryOutcomes(), ", "))
		}
		// The check is on the evidence as it will be recorded, not as the row
		// handed it over: a line of nothing but bytes that are not text is a
		// row with nothing to show, however many bytes it is.
		evidence := cut(got.Evidence)
		if evidence == "" {
			return RunResult{}, fmt.Errorf("the row %q reported %s with no evidence for it",
				row.ID, got.Outcome)
		}

		result := RowResult{
			ID:         row.ID,
			Kind:       row.Kind,
			Severity:   row.Severity,
			Outcome:    got.Outcome,
			Evidence:   evidence,
			DurationMS: elapsed,
		}
		res.Rows = append(res.Rows, result)
		res.Counts[got.Outcome]++

		_, err := journal.WriteBatteryRow(repoDir, journal.BatteryRow{
			RunID:      id,
			RowID:      row.ID,
			Outcome:    string(got.Outcome),
			Evidence:   evidence,
			DurationMS: elapsed,
		})
		if err != nil {
			return RunResult{}, fmt.Errorf("could not journal the row %q: %w", row.ID, err)
		}
	}

	res.DurationMS = int(time.Since(start).Milliseconds())

	counts := map[string]int{}
	for outcome, n := range res.Counts {
		counts[string(outcome)] = n
	}

	_, err = journal.WriteBattery(repoDir, journal.Battery{
		RunID:      id,
		Version:    res.Version,
		Counts:     counts,
		DurationMS: res.DurationMS,
	})
	if err != nil {
		return RunResult{}, fmt.Errorf("could not journal the run %s: %w", id, err)
	}

	return res, nil
}

// runIDStamp is RFC3339 with the punctuation taken out, so a run id is one
// word that sorts by time.
const runIDStamp = "20060102T150405Z"

// runIDBytes is how many random bytes a run id carries, printed as hex. The
// stamp is only good to the second, and two runs can share a second.
const runIDBytes = 2

// newRunID returns a fresh run id: run-<RFC3339-compact>-<4hex>.
func newRunID() (string, error) {
	raw := make([]byte, runIDBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate a run id: %w", err)
	}

	return "run-" + time.Now().UTC().Format(runIDStamp) + "-" + hex.EncodeToString(raw), nil
}

// cut makes a row's evidence fit on a journal line: valid text, no longer
// than the journal's cap, and saying where it was shortened.
//
// Bytes that are not UTF-8 are dropped first, one byte at a time. A row that
// shells out to another tool can come back holding them, and they must not
// take the readable part of the line with them — a single bad byte at the
// front is not a reason to record nothing. What survives is the row's words.
//
// Only then is the line shortened, at a rune boundary, with three dots to stop
// a cut line reading as the whole one. A row that had more to say is better
// recorded short than not at all.
func cut(evidence string) string {
	evidence = strings.ToValidUTF8(evidence, "")

	if len(evidence) <= journal.MaxTextBytes {
		return evidence
	}

	const mark = "..."

	// Only a partial rune can be invalid here, so this backs off at most three
	// bytes.
	kept := evidence[:journal.MaxTextBytes-len(mark)]
	for len(kept) > 0 && !utf8.ValidString(kept) {
		kept = kept[:len(kept)-1]
	}

	return kept + mark
}

// checkRow rejects a row the battery cannot hold.
func checkRow(row Row) error {
	if err := checkRowID(row.ID); err != nil {
		return err
	}
	if !slices.Contains(kinds, row.Kind) {
		return fmt.Errorf("the row %q has the kind %q, which is not one of: %s",
			row.ID, row.Kind, strings.Join(kinds, ", "))
	}
	if !slices.Contains(severities, row.Severity) {
		return fmt.Errorf("the row %q has the severity %q, which is not one of: %s",
			row.ID, row.Severity, strings.Join(severities, ", "))
	}
	if row.Check == nil {
		return fmt.Errorf("the row %q has no check", row.ID)
	}

	return nil
}

// checkRowID rejects a row id outside the charset.
//
// The charset is tighter than the journal's rule for a session id, which has
// to survive as a path component. A row id has a different job: it is printed
// in tables, typed into waiver files, and hashed into the version. One
// spelling per row is what makes those three agree, so uppercase, dots and
// underscores are all out.
func checkRowID(id string) error {
	if id == "" {
		return fmt.Errorf("a row has an empty id")
	}
	if len(id) > maxRowIDBytes {
		return fmt.Errorf("a row id is %d bytes, over the limit of %d", len(id), maxRowIDBytes)
	}

	for _, r := range id {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-':
		default:
			return fmt.Errorf("the row id %q holds %q, which is not a lowercase letter, a digit or a dash", id, r)
		}
	}

	return nil
}
