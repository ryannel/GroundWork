// Package plan reads the plan artifacts: the program file, the bet file, and
// the per-slice proof plan.
//
// Three committed markdown files hold a plan (R1). Every machine-read field
// lives in the frontmatter, and everything below it is prose no parser reads.
// The shapes are written down in docs/derivation-contract.md section 1, and a
// test holds that page and this package together — read and write ship in one
// commit, which is what surfaces.md asks for.
//
//	docs/plan/<program>/program.md
//	docs/plan/<program>/<bet>/bet.md
//	docs/plan/<program>/<bet>/<slice>.md
//
// An id is lowercase letters, digits and underscore, and it names one thing in
// the whole repo. The directory or file a unit sits in spells the same id the
// unit declares, so a reference reaches one file and never two.
//
// What this package does not do is decide anything. It reads what somebody
// wrote and says whether it holds together. Whether the work is done, and
// whether a proof is red for the right reason, are derived from git and from
// the test run, in later slices of this bet.
package plan

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Dir is where plans live, named from the repo root.
const Dir = "docs/plan"

// The two answers that are not a problem with anybody's plan.
var (
	// ErrNoPlanDir says the repo has no plan directory at all. A repo that
	// states no plan cannot misstate one, so a caller reads this as fine.
	ErrNoPlanDir = errors.New("this repo has no " + Dir + " directory")

	// ErrNoUnits says the plan directory is there and holds no plan file of any
	// kind. That is not a pass: D17 rules that a verifier may never pass on
	// nothing, and somebody halfway through writing their first plan is who
	// this protects.
	//
	// It is the answer only when there was nothing at all to parse. One plan
	// file of any kind — a program file, a bet file, a slice file — means there
	// is a plan, and a misshapen plan is red. D45 ruled that line.
	ErrNoUnits = errors.New(Dir + " is there and holds no plan file")
)

// Program is one program file.
type Program struct {
	Path   string
	ID     string
	Title  string
	Goal   string
	Done   string
	Ladder []LadderEntry
}

// LadderEntry is one bet on a program's ladder. Only the next bet is designed
// in full, so a later entry is one line and a proof sketch, and nothing here
// resolves it to a file.
type LadderEntry struct {
	ID          string
	Line        string
	ProofSketch string
}

// Bet is one bet file.
type Bet struct {
	Path       string
	ID         string
	Title      string
	Program    string
	Design     []string
	Milestones []Milestone
	Slices     []SliceEntry
	Facing     []Facing
	Deferred   []Deferral
	Premises   []string
}

// Milestone is one milestone of a bet. A milestone is a section of the bet
// file rather than a file of its own (R1): its only machine-read content is
// its order and the slices that sit on it.
type Milestone struct {
	ID    string
	Title string
}

// SliceEntry is one slice in a bet's ordered list, with the milestone it sits
// on.
type SliceEntry struct {
	ID        string
	Milestone string
}

// Facing is one user-visible thing the bet's design names.
type Facing struct {
	ID   string
	Line string
}

// Deferral is a facing item the bet does not deliver, with the reason.
type Deferral struct {
	ID     string
	Reason string
}

// Slice is one slice's proof plan.
type Slice struct {
	Path      string
	ID        string
	Bet       string
	Milestone string
	Proofs    []Proof
	Fixtures  []string
	Real      []string
	Faked     []string
	Facing    []string
	Records   []string
	Data      *Data
}

// Proof is one proof a slice plans.
type Proof struct {
	ID            string
	Marker        string
	From          string
	Headline      bool
	RetireAtClose bool
}

// Data is what a slice that touches data owes: whether the change can be
// undone, how long the proof runs, and where its fixture came from.
//
// The block's presence is the declaration. A slice that writes the block says
// it touches data; a slice that leaves it out says it does not. D45 removed
// the separate boolean that used to say the same thing, because two ways to
// say one thing is two things to keep in step.
type Data struct {
	Reversibility     string
	RuntimeClass      string
	FixtureProvenance string
}

// Set is every plan unit one repo holds.
type Set struct {
	Programs []Program
	Bets     []Bet
	Slices   []Slice
}

// ParseProgram reads one program file.
func ParseProgram(file string, raw []byte) (Program, error) {
	root, err := parseFrontmatter(file, raw)
	if err != nil {
		return Program{}, err
	}

	b := newBinder(file, "program", root, programKeys)

	out := Program{
		Path:  file,
		ID:    b.id("id"),
		Title: b.scalar("title", true),
		Goal:  b.scalar("goal", true),
		Done:  b.scalar("done", true),
	}
	for _, entry := range b.atLeastOneBlock("ladder", "ladder entry", ladderKeys) {
		out.Ladder = append(out.Ladder, LadderEntry{
			ID:          entry.id("id"),
			Line:        entry.scalar("line", true),
			ProofSketch: entry.scalar("proof_sketch", true),
		})
	}

	if err := b.err(); err != nil {
		return Program{}, err
	}

	return out, nil
}

// ParseBet reads one bet file.
func ParseBet(file string, raw []byte) (Bet, error) {
	root, err := parseFrontmatter(file, raw)
	if err != nil {
		return Bet{}, err
	}

	b := newBinder(file, "bet", root, betKeys)

	out := Bet{
		Path:     file,
		ID:       b.id("id"),
		Title:    b.scalar("title", true),
		Program:  b.id("program"),
		Design:   b.paths("design", true),
		Premises: b.ids("premises", false),
	}
	if len(out.Design) == 0 {
		b.empty("design")
	}
	for _, entry := range b.atLeastOneBlock("milestones", "milestone", milestoneKeys) {
		out.Milestones = append(out.Milestones, Milestone{
			ID:    entry.id("id"),
			Title: entry.scalar("title", true),
		})
	}
	for _, entry := range b.atLeastOneBlock("slices", "bet slice", betSliceKeys) {
		out.Slices = append(out.Slices, SliceEntry{
			ID:        entry.id("id"),
			Milestone: entry.id("milestone"),
		})
	}
	for _, entry := range b.blocks("facing", "facing item", facingKeys, false) {
		out.Facing = append(out.Facing, Facing{
			ID:   entry.id("id"),
			Line: entry.scalar("line", true),
		})
	}
	for _, entry := range b.blocks("deferred", "deferral", deferralKeys, false) {
		out.Deferred = append(out.Deferred, Deferral{
			ID:     entry.id("id"),
			Reason: entry.scalar("reason", true),
		})
	}

	if err := b.err(); err != nil {
		return Bet{}, err
	}

	return out, nil
}

// ParseSlice reads one slice's proof plan.
func ParseSlice(file string, raw []byte) (Slice, error) {
	root, err := parseFrontmatter(file, raw)
	if err != nil {
		return Slice{}, err
	}

	b := newBinder(file, "slice plan", root, sliceKeys)

	out := Slice{
		Path:      file,
		ID:        b.id("id"),
		Bet:       b.id("bet"),
		Milestone: b.id("milestone"),
	}
	for _, entry := range b.atLeastOneBlock("proofs", "proof", proofKeys) {
		proof := Proof{
			ID:            entry.id("id"),
			From:          entry.scalar("from", true),
			Headline:      entry.flag("headline"),
			RetireAtClose: entry.flag("retire_at_close"),
			Marker:        entry.scalar("marker", true),
		}
		entry.checkMarker(proof.ID, proof.Marker)
		entry.checkFrom(proof.From)
		out.Proofs = append(out.Proofs, proof)
	}

	out.Fixtures = b.lines("fixtures", true)
	out.Real = b.lines("real", true)
	out.Faked = b.lines("faked", true)
	out.Facing = b.ids("facing", false)
	out.Records = b.paths("records", false)
	out.Data = b.data()

	if err := b.err(); err != nil {
		return Slice{}, err
	}

	return out, nil
}

// data reads the block a slice that touches data owes.
//
// The block is optional, and writing it is the declaration (D45). A slice
// that writes it owes all three entries, and the block binder says which one
// is missing.
func (b *binder) data() *Data {
	value, present := b.get("data")
	if !present {
		return nil
	}

	if value.kind != blockNode {
		b.fail(value.line, "the field %q holds %s where a block of fields was wanted", "data", describe(value))

		return nil
	}

	d := b.sub(value, "data block", dataKeys)

	return &Data{
		Reversibility:     d.scalar("reversibility", true),
		RuntimeClass:      d.scalar("runtime_class", true),
		FixtureProvenance: d.scalar("fixture_provenance", true),
	}
}

// markerPrefix is what a proof's test name opens with, per R9. The proof id is
// spelled inside the test name, so the plan file and the test carry one
// spelling of it and go test -run can filter on it.
const markerPrefix = "TestProof_"

// checkMarker holds a proof's test name to R9.
func (b *binder) checkMarker(id, marker string) {
	if id == "" || marker == "" {
		return
	}

	want := markerPrefix + id + "_"
	if !strings.HasPrefix(marker, want) || len(marker) == len(want) {
		b.fail(b.n.fields["marker"].line,
			"the proof %s has the marker %q, and a marker is %s followed by readable words", id, clip(marker), want)

		return
	}

	for _, r := range marker {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_') {
			b.fail(b.n.fields["marker"].line,
				"the marker %q holds %q, and a marker is a Go test name", clip(marker), r)

			return
		}
	}
}

// checkFrom holds a proof's backward reference to its shape: a design path
// from the repo root, a #, and an anchor.
//
// Whether the anchor resolves inside a sealed design file is the traceability
// row's question, and it lands in a later slice. What lands here is the shape
// and the file, because a path that names nothing is wrong whoever reads it.
func (b *binder) checkFrom(from string) {
	if from == "" {
		return
	}

	line := b.n.fields["from"].line

	where, anchor, found := strings.Cut(from, "#")
	if !found || anchor == "" || where == "" {
		b.fail(line, "the field %q holds %q, and a proof comes from a design path, a #, and an anchor",
			"from", clip(from))

		return
	}
	if strings.Contains(anchor, "#") {
		b.fail(line, "the field %q holds %q, which holds a second #, and a proof comes from one anchor",
			"from", clip(from))

		return
	}
	if err := checkPath(where); err != nil {
		b.fail(line, "the field %q holds %q, whose path %s", "from", clip(from), err)

		return
	}
	if strings.ContainsAny(anchor, " \t") {
		b.fail(line, "the field %q holds %q, whose anchor holds a space", "from", clip(from))
	}
}

// Load reads every plan unit under the repo at root.
//
// It reads whole files and collects every problem it finds, rather than
// stopping at the first. A reader who has to run the check once per mistake
// stops running it.
func Load(root string) (Set, error) {
	dir := filepath.Join(root, filepath.FromSlash(Dir))

	info, err := os.Stat(dir)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return Set{}, ErrNoPlanDir
	case err != nil:
		return Set{}, fmt.Errorf("could not read %s: %w", Dir, reasonOnly(err))
	case !info.IsDir():
		return Set{}, fmt.Errorf("%s is a file, and plans live in a directory", Dir)
	}

	var set Set

	plans := 0

	problems := walkPlans(root, &set, &plans)

	// D45 rules the line: "Only a docs/plan that offers nothing to parse has
	// nothing to misstate." So the question is whether the walk met a plan file
	// at all — any of the three kinds, whether or not it read. None means
	// somebody has started and not finished, and the answer is unrunnable,
	// naming what the directory held instead.
	//
	// One plan file is enough to make everything else red, the missing ones
	// included. Counting program.md alone was wrong: a complete bet with its
	// slices under a directory with no program.md read as unrunnable, and
	// unrunnable never fails a run — so deleting one file silenced every
	// misstatement below it (F43).
	if plans == 0 {
		if len(problems) == 0 {
			return Set{}, ErrNoUnits
		}

		return Set{}, fmt.Errorf("%w. %s", ErrNoUnits, countedProblems(problems))
	}

	problems = append(problems, resolve(root, &set)...)
	if len(problems) > 0 {
		return Set{}, errors.New(countedProblems(problems))
	}

	return set, nil
}

// walkPlans reads the tree under the plan directory into set, and returns what
// was in the wrong place. plans counts the plan files it met — a program file,
// a bet file, a slice file — whether or not they read.
func walkPlans(root string, set *Set, plans *int) []string {
	var problems []string

	entries, err := os.ReadDir(filepath.Join(root, filepath.FromSlash(Dir)))
	if err != nil {
		return []string{fmt.Sprintf("could not read %s: %v", Dir, reasonOnly(err))}
	}

	for _, entry := range entries {
		where := path.Join(Dir, entry.Name())
		if !entry.IsDir() {
			problems = append(problems,
				fmt.Sprintf("%s is a file, and %s holds one directory per program", where, Dir))

			continue
		}

		problems = append(problems, walkProgram(root, entry.Name(), set, plans)...)
	}

	return problems
}

// walkProgram reads one program directory: its program file, and one directory
// per bet.
func walkProgram(root, name string, set *Set, plans *int) []string {
	var problems []string

	where := path.Join(Dir, name)

	entries, err := os.ReadDir(filepath.Join(root, filepath.FromSlash(where)))
	if err != nil {
		return []string{fmt.Sprintf("could not read %s: %v", where, reasonOnly(err))}
	}

	found := false
	for _, entry := range entries {
		at := path.Join(where, entry.Name())
		if entry.IsDir() {
			problems = append(problems, walkBet(root, at, entry.Name(), set, plans)...)

			continue
		}
		if entry.Name() != "program.md" {
			problems = append(problems, fmt.Sprintf(
				"%s is not a plan file: a program directory holds program.md and one directory per bet", at))

			continue
		}

		found = true
		*plans++

		raw, err := readPlanFile(root, at)
		if err != nil {
			problems = append(problems, err.Error())

			continue
		}

		program, err := ParseProgram(at, raw)
		if err != nil {
			problems = append(problems, err.Error())

			continue
		}
		if program.ID != name {
			problems = append(problems, fmt.Sprintf("%s declares the id %q, and its directory is named %q",
				at, program.ID, name))

			continue
		}

		set.Programs = append(set.Programs, program)
	}

	if !found {
		problems = append(problems, fmt.Sprintf("%s holds no program.md", where))
	}

	return problems
}

// walkBet reads one bet directory: its bet file, and one file per slice.
func walkBet(root, where, name string, set *Set, plans *int) []string {
	var problems []string

	entries, err := os.ReadDir(filepath.Join(root, filepath.FromSlash(where)))
	if err != nil {
		return []string{fmt.Sprintf("could not read %s: %v", where, reasonOnly(err))}
	}

	found := false
	for _, entry := range entries {
		at := path.Join(where, entry.Name())
		if entry.IsDir() {
			problems = append(problems, fmt.Sprintf(
				"%s is a directory, and a bet directory holds bet.md and one file per slice", at))

			continue
		}
		if !strings.HasSuffix(entry.Name(), ".md") {
			problems = append(problems, fmt.Sprintf(
				"%s is not a plan file: a bet directory holds bet.md and one .md file per slice", at))

			continue
		}

		// A bet file and a slice file are plan files as much as a program file
		// is. Something was offered to parse here, so everything wrong below
		// this directory is red, and the missing program.md above it is one of
		// the things that is wrong.
		*plans++

		raw, err := readPlanFile(root, at)
		if err != nil {
			problems = append(problems, err.Error())

			continue
		}

		if entry.Name() == "bet.md" {
			found = true

			bet, err := ParseBet(at, raw)
			if err != nil {
				problems = append(problems, err.Error())

				continue
			}
			if bet.ID != name {
				problems = append(problems, fmt.Sprintf("%s declares the id %q, and its directory is named %q",
					at, bet.ID, name))

				continue
			}

			set.Bets = append(set.Bets, bet)

			continue
		}

		slice, err := ParseSlice(at, raw)
		if err != nil {
			problems = append(problems, err.Error())

			continue
		}

		stem := strings.TrimSuffix(entry.Name(), ".md")
		if slice.ID != stem {
			problems = append(problems, fmt.Sprintf("%s declares the id %q, and its file is named %q",
				at, slice.ID, stem))

			continue
		}

		set.Slices = append(set.Slices, slice)
	}

	if !found {
		problems = append(problems, fmt.Sprintf("%s holds no bet.md", where))
	}

	return problems
}

// readPlanFile reads one plan file's bytes.
//
// The error keeps the reason and drops the absolute path the operating system
// puts in front of it. A plan file is named from the repo root everywhere else
// in this package, and a message that named a directory on the machine that
// ran the check would say nothing to whoever reads it.
func readPlanFile(root, where string) ([]byte, error) {
	raw, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(where)))
	if err != nil {
		return nil, fmt.Errorf("could not read %s: %w", where, reasonOnly(err))
	}

	return raw, nil
}

// reasonOnly strips the operation and the path off a file error, leaving why
// it failed.
func reasonOnly(err error) error {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err
	}

	return err
}

// countedProblems turns the problems into one line: how many there are, then
// the first of them. All of them would not fit on a line of evidence, and the
// count is what tells the reader whether fixing the first one finishes the job.
//
// The count is written first because the line is cut from the end. D33 rules
// that words give way and counts never do, so the count sits where no cut can
// reach it, and what a cut takes is the tail of somebody's file path.
func countedProblems(problems []string) string {
	if len(problems) == 1 {
		return "1 problem: " + problems[0]
	}

	return fmt.Sprintf("%d problems, the first: %s", len(problems), problems[0])
}
