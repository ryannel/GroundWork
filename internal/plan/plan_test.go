package plan

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// These tests prove the parser and the resolver this slice ships. The shapes
// they exercise are written down in docs/derivation-contract.md, section 1,
// "The plan files" — read and write ship together, so the page and this file
// have to agree, and TestProof_b3s1_contract_names_every_field_the_parser_reads
// is what holds them together.

// --- fixtures -------------------------------------------------------------

// The fixture plan is one program, one bet, one slice, and it resolves. Most
// tests take a copy, break one thing, and check the reader says which thing.
// The blocks are separate constants so a case can take a whole field out
// without leaving its entries behind.

const programLadder = `ladder:
  - id: demo_bet
    line: The only bet with files of its own.
    proof_sketch: The reader parses its bet file and its slice file.
  - id: demo_later
    line: A later bet, one line and no files yet.
    proof_sketch: Nothing is written for it until it is next.
`

const goodProgram = `---
id: demo
title: The demo program
goal: Show what a plan file looks like.
done: One committed file per unit, and the reader parses all three.
` + programLadder + `---

Prose below the frontmatter. No parser reads this.
`

const betMilestones = `milestones:
  - id: demo_m1
    title: The first milestone
`

const betSlices = `slices:
  - id: demo_s1
    milestone: demo_m1
`

const goodBet = `---
id: demo_bet
title: The demo bet
program: demo
design:
  - docs/design.md
` + betMilestones + betSlices + `facing:
  - id: demo_f1
    line: The verb prints a table.
  - id: demo_f2
    line: The verb prints a board.
deferred:
  - id: demo_f2
    reason: The board lands in a later slice.
---

Prose.
`

const sliceProofs = `proofs:
  - id: demo_p1
    marker: TestProof_demo_p1_the_table_prints
    from: docs/design.md#one
    headline: true
    retire_at_close: false
`

const goodSlice = `---
id: demo_s1
bet: demo_bet
milestone: demo_m1
` + sliceProofs + `fixtures:
  - an empty table and a full one
real:
  - the parser
faked: []
facing:
  - demo_f1
records:
  - docs/derivation-contract.md
---

Prose.
`

const programPath = "docs/plan/demo/program.md"
const betPath = "docs/plan/demo/demo_bet/bet.md"
const slicePath = "docs/plan/demo/demo_bet/demo_s1.md"

// goodFiles is the fixture plan as a path-to-content map, ready to be broken.
func goodFiles() map[string]string {
	return map[string]string{
		"docs/design.md":              "# The design\n",
		"docs/derivation-contract.md": "# The contract\n",
		programPath:                   goodProgram,
		betPath:                       goodBet,
		slicePath:                     goodSlice,
	}
}

// writeTree writes every file of a fixture into a fresh directory and returns
// it. The reader is handed a repo root, so the fixture is one.
func writeTree(t *testing.T, files map[string]string) string {
	t.Helper()

	root := t.TempDir()
	for rel, content := range files {
		path := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("could not write %s: %v", rel, err)
		}
	}

	return root
}

// loadBroken writes the good fixture with one file replaced, loads it, and
// returns the error text. A load that worked is the failure: every caller of
// this broke something on purpose.
func loadBroken(t *testing.T, rel, content string) string {
	t.Helper()

	files := goodFiles()
	files[rel] = content

	_, err := Load(writeTree(t, files))
	if err == nil {
		t.Fatalf("the reader accepted a plan whose %s was broken", rel)
	}

	return err.Error()
}

// --- the three shapes -----------------------------------------------------

// TestProof_b3s1_shapes_the_three_plan_files_parse reads one of each shape and
// checks every field R2 names lands where the reader promises.
// Contract: docs/derivation-contract.md section 1.
func TestProof_b3s1_shapes_the_three_plan_files_parse(t *testing.T) {
	set, err := Load(writeTree(t, goodFiles()))
	if err != nil {
		t.Fatalf("the good fixture did not load: %v", err)
	}

	if len(set.Programs) != 1 || len(set.Bets) != 1 || len(set.Slices) != 1 {
		t.Fatalf("the fixture loaded %d programs, %d bets and %d slices, want 1 of each",
			len(set.Programs), len(set.Bets), len(set.Slices))
	}

	program := set.Programs[0]
	if program.ID != "demo" || program.Title != "The demo program" {
		t.Errorf("the program read as %q/%q", program.ID, program.Title)
	}
	if program.Goal == "" || program.Done == "" {
		t.Errorf("the program's goal or done line is empty: %q, %q", program.Goal, program.Done)
	}
	if len(program.Ladder) != 2 {
		t.Fatalf("the program's ladder holds %d entries, want 2", len(program.Ladder))
	}
	if program.Ladder[0].ID != "demo_bet" || program.Ladder[1].ID != "demo_later" {
		t.Errorf("the ladder is out of order: %v", program.Ladder)
	}
	if program.Ladder[1].Line == "" || program.Ladder[1].ProofSketch == "" {
		t.Errorf("a ladder entry lost its line or its proof sketch: %+v", program.Ladder[1])
	}
	if program.Path != programPath {
		t.Errorf("the program's path reads %q", program.Path)
	}

	bet := set.Bets[0]
	if bet.ID != "demo_bet" || bet.Program != "demo" || bet.Title != "The demo bet" {
		t.Errorf("the bet read as %q/%q under %q", bet.ID, bet.Title, bet.Program)
	}
	if len(bet.Design) != 1 || bet.Design[0] != "docs/design.md" {
		t.Errorf("the bet's design paths read %v", bet.Design)
	}
	if len(bet.Milestones) != 1 || bet.Milestones[0].ID != "demo_m1" ||
		bet.Milestones[0].Title != "The first milestone" {
		t.Errorf("the bet's milestones read %v", bet.Milestones)
	}
	if len(bet.Slices) != 1 || bet.Slices[0].ID != "demo_s1" || bet.Slices[0].Milestone != "demo_m1" {
		t.Errorf("the bet's slices read %v", bet.Slices)
	}
	if len(bet.Facing) != 2 || bet.Facing[0].ID != "demo_f1" || bet.Facing[0].Line == "" {
		t.Errorf("the bet's facing list read %v", bet.Facing)
	}
	if len(bet.Deferred) != 1 || bet.Deferred[0].ID != "demo_f2" || bet.Deferred[0].Reason == "" {
		t.Errorf("the bet's deferrals read %v", bet.Deferred)
	}
	if len(bet.Premises) != 0 {
		t.Errorf("the bet declares no premises and the reader read %v", bet.Premises)
	}

	slice := set.Slices[0]
	if slice.ID != "demo_s1" || slice.Bet != "demo_bet" || slice.Milestone != "demo_m1" {
		t.Errorf("the slice read as %q in %q at %q", slice.ID, slice.Bet, slice.Milestone)
	}
	if len(slice.Proofs) != 1 {
		t.Fatalf("the slice holds %d proofs, want 1", len(slice.Proofs))
	}

	proof := slice.Proofs[0]
	if proof.ID != "demo_p1" || proof.Marker != "TestProof_demo_p1_the_table_prints" {
		t.Errorf("the proof read as %q/%q", proof.ID, proof.Marker)
	}
	if proof.From != "docs/design.md#one" {
		t.Errorf("the proof's from field read %q", proof.From)
	}
	if !proof.Headline || proof.RetireAtClose {
		t.Errorf("the proof's flags read headline=%v retire_at_close=%v", proof.Headline, proof.RetireAtClose)
	}
	if len(slice.Fixtures) != 1 || len(slice.Real) != 1 || len(slice.Faked) != 0 {
		t.Errorf("the slice's axes read fixtures=%v real=%v faked=%v", slice.Fixtures, slice.Real, slice.Faked)
	}
	if len(slice.Facing) != 1 || slice.Facing[0] != "demo_f1" {
		t.Errorf("the slice's facing claims read %v", slice.Facing)
	}
	if len(slice.Records) != 1 || slice.Records[0] != "docs/derivation-contract.md" {
		t.Errorf("the slice's records read %v", slice.Records)
	}
	if slice.Data != nil {
		t.Errorf("the slice writes no data block and the reader made one: %+v", slice.Data)
	}
	if slice.Path != slicePath {
		t.Errorf("the slice's path reads %q", slice.Path)
	}
}

// The prose below the frontmatter is not read, so rewriting it can never change
// what the reader sees. R1 turns on that.
func TestProseBelowTheFrontmatterIsNotRead(t *testing.T) {
	files := goodFiles()
	files[slicePath] = goodSlice +
		"\n---\nid: not_the_id\nbet: not_the_bet\n---\n\nMore prose, holding words that look like fields.\n"

	set, err := Load(writeTree(t, files))
	if err != nil {
		t.Fatalf("prose below the frontmatter broke the load: %v", err)
	}
	if set.Slices[0].ID != "demo_s1" {
		t.Errorf("the slice's id read %q, so something below the frontmatter was read", set.Slices[0].ID)
	}
}

// Writing the data block is the declaration (D45). A slice that writes it owes
// all three entries proof.md names; a slice that leaves it out is saying it
// touches no data, and there is no second field to keep in step.
func TestTheDataBlockIsItsOwnDeclaration(t *testing.T) {
	const wholeBlock = `data:
  reversibility: the fixture is a copy, and the copy is thrown away
  runtime_class: seconds
  fixture_provenance: written for this slice
`

	files := goodFiles()
	files[slicePath] = strings.Replace(goodSlice, "records:\n", wholeBlock+"records:\n", 1)

	set, err := Load(writeTree(t, files))
	if err != nil {
		t.Fatalf("a data-touching slice did not load: %v", err)
	}

	data := set.Slices[0].Data
	if data == nil {
		t.Fatal("the data block was dropped")
	}
	if data.Reversibility == "" || data.RuntimeClass == "" || data.FixtureProvenance == "" {
		t.Errorf("the data block read %+v", data)
	}

	cases := []struct{ name, content, want string }{
		{
			"half written",
			strings.Replace(goodSlice, "records:\n", "data:\n  reversibility: none\nrecords:\n", 1),
			"runtime_class",
		},
		{
			"an entry the block does not hold",
			strings.Replace(goodSlice, "records:\n",
				strings.Replace(wholeBlock, "  runtime_class: seconds\n", "  runtime_class: seconds\n  undo: yes\n", 1)+
					"records:\n", 1),
			"undo",
		},
		{
			"written as a line of text",
			strings.Replace(goodSlice, "records:\n", "data: none\nrecords:\n", 1),
			"data",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := loadBroken(t, slicePath, c.content)
			if !strings.Contains(got, c.want) {
				t.Errorf("the reader said %q, and it does not name %q", got, c.want)
			}
		})
	}
}

// touches_data was removed with D45, and a plan file that still carries it must
// be told so rather than quietly read. The closed key list is what says it: a
// field the shape does not hold is a typo, and a typo that was ignored leaves
// the writer looking at a file that seems right.
func TestTheRemovedTouchesDataFieldIsRefused(t *testing.T) {
	got := loadBroken(t, slicePath, strings.Replace(goodSlice, "records:\n", "touches_data: false\nrecords:\n", 1))
	if !strings.Contains(got, "touches_data") {
		t.Errorf("the reader said %q, and it does not name the field it will not read", got)
	}
}

// --- hostile frontmatter --------------------------------------------------

// TestProof_b3s1_hostile_frontmatter_is_refused_by_name drives D18's list
// through the slice parser. Each case names what the reader must say, because a
// reader that refuses everything with one word is no better than one that
// accepts everything.
// Contract: docs/derivation-contract.md section 1.
func TestProof_b3s1_hostile_frontmatter_is_refused_by_name(t *testing.T) {
	cases := []struct{ name, content, want string }{
		{
			"no frontmatter at all",
			"# A plan file\n\nid: demo_s1\nbet: demo_bet\n",
			"frontmatter",
		},
		{
			"an empty file",
			"",
			"frontmatter",
		},
		{
			"frontmatter that never closes",
			"---\nid: demo_s1\nbet: demo_bet\n",
			"frontmatter",
		},
		{
			"an id holding a dash",
			strings.Replace(goodSlice, "id: demo_s1", "id: demo-s1", 1),
			"'-'",
		},
		{
			"an id holding a capital",
			strings.Replace(goodSlice, "id: demo_s1", "id: demoS1", 1),
			"'S'",
		},
		{
			"an id holding unicode",
			strings.Replace(goodSlice, "id: demo_s1", "id: demo_sı", 1),
			"id",
		},
		{
			"an id holding a space",
			strings.Replace(goodSlice, "id: demo_s1", "id: demo s1", 1),
			"id",
		},
		{
			"a scalar field given a list",
			strings.Replace(goodSlice, "id: demo_s1", "id:\n  - demo_s1\n  - demo_s2", 1),
			"id",
		},
		{
			"a list field given a scalar",
			strings.Replace(goodSlice, "real:\n  - the parser\n", "real: the parser\n", 1),
			"real",
		},
		{
			"a list of blocks given a list of lines",
			strings.Replace(goodSlice, sliceProofs, "proofs:\n  - demo_p1\n", 1),
			"proofs",
		},
		{
			"a flag that is not true or false",
			strings.Replace(goodSlice, "headline: true", "headline: yes", 1),
			"headline",
		},
		{
			"a key nobody reads",
			strings.Replace(goodSlice, "id: demo_s1", "id: demo_s1\nlane: complex", 1),
			"lane",
		},
		{
			"the same key twice",
			strings.Replace(goodSlice, "id: demo_s1", "id: demo_s1\nid: demo_s2", 1),
			"twice",
		},
		{
			"a required field left out",
			strings.Replace(goodSlice, "milestone: demo_m1\n", "", 1),
			"milestone",
		},
		{
			"a required list written empty",
			strings.Replace(goodSlice, sliceProofs, "proofs: []\n", 1),
			"proofs",
		},
		{
			"a field with no value at all",
			strings.Replace(goodSlice, "id: demo_s1", "id:", 1),
			"id",
		},
		{
			"indentation written with a tab",
			strings.Replace(goodSlice, "  - the parser", "\t- the parser", 1),
			"tab",
		},
		{
			"a marker that does not spell the proof id",
			strings.Replace(goodSlice, "TestProof_demo_p1_the_table_prints", "TestProof_demo_p2_the_table_prints", 1),
			"marker",
		},
		{
			"a marker outside the naming rule",
			strings.Replace(goodSlice, "TestProof_demo_p1_the_table_prints", "TestTheTablePrints", 1),
			"marker",
		},
		{
			"a from field with no anchor",
			strings.Replace(goodSlice, "from: docs/design.md#one", "from: docs/design.md", 1),
			"from",
		},
		{
			"a from field with two anchors",
			strings.Replace(goodSlice, "from: docs/design.md#one", "from: docs/design.md#one#two", 1),
			"second #",
		},
		{
			"an absolute path in a design reference",
			strings.Replace(goodSlice, "from: docs/design.md#one", "from: /home/user/repo/docs/design.md#one", 1),
			"absolute",
		},
		{
			"a design reference climbing out of the repo",
			strings.Replace(goodSlice, "from: docs/design.md#one", "from: ../other/design.md#one", 1),
			"..",
		},
		{
			// The want names the file cap's own words. "bytes" alone would be
			// satisfied by the scalar cap, which this content also breaks, and
			// the case would then pass with the file cap taken out (F-M7).
			"an enormous file",
			strings.Replace(goodSlice, "  - the parser",
				"  - the parser\n  - "+strings.Repeat("x", maxFileBytes), 1),
			"for a plan file",
		},
		{
			"an enormous single value",
			strings.Replace(goodSlice, "  - the parser",
				"  - "+strings.Repeat("x", maxScalarBytes+1), 1),
			"this value is",
		},
		{
			"a field name holding a capital",
			strings.Replace(goodSlice, "id: demo_s1", "Id: demo_s1", 1),
			"a field name is lowercase letters",
		},
		{
			"an enormous field name",
			strings.Replace(goodSlice, "id: demo_s1", strings.Repeat("k", maxKeyBytes+1)+": demo_s1", 1),
			"a field name of",
		},
		{
			"a line that opens with a colon",
			strings.Replace(goodSlice, "id: demo_s1", ": demo_s1", 1),
			"names no field",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := ParseSlice(slicePath, []byte(c.content))
			if err == nil {
				t.Fatalf("the parser accepted %s", c.name)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the parser said %q, and it does not name %q", err.Error(), c.want)
			}
			if !strings.Contains(err.Error(), "demo_s1.md") {
				t.Errorf("the parser said %q, and it does not name the file", err.Error())
			}
		})
	}
}

// The program and bet parsers face the same hostility. Each shape has its own
// required fields, and each one has to name the field it missed.
func TestHostileProgramAndBetFrontmatter(t *testing.T) {
	programCases := []struct{ name, content, want string }{
		{"no ladder", strings.Replace(goodProgram, programLadder, "", 1), "ladder"},
		{"an empty ladder", strings.Replace(goodProgram, programLadder, "ladder: []\n", 1), "ladder"},
		{"a ladder entry with no line",
			strings.Replace(goodProgram, "    line: The only bet with files of its own.\n", "", 1), "line"},
		{"a ladder entry with no sketch",
			strings.Replace(goodProgram, "    proof_sketch: The reader parses its bet file and its slice file.\n", "", 1),
			"proof_sketch"},
		{"no goal", strings.Replace(goodProgram, "goal: Show what a plan file looks like.\n", "", 1), "goal"},
		{"no done line", strings.Replace(goodProgram,
			"done: One committed file per unit, and the reader parses all three.\n", "", 1), "done"},
	}
	for _, c := range programCases {
		t.Run("program/"+c.name, func(t *testing.T) {
			_, err := ParseProgram(programPath, []byte(c.content))
			if err == nil {
				t.Fatalf("the parser accepted %s", c.name)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the parser said %q, and it does not name %q", err.Error(), c.want)
			}
		})
	}

	betCases := []struct{ name, content, want string }{
		{"no program", strings.Replace(goodBet, "program: demo\n", "", 1), "program"},
		{"no design", strings.Replace(goodBet, "design:\n  - docs/design.md\n", "", 1), "design"},
		{"no milestones", strings.Replace(goodBet, betMilestones, "", 1), "milestones"},
		{"no slices", strings.Replace(goodBet, betSlices, "", 1), "slices"},
		{"a milestone with no title", strings.Replace(goodBet, "    title: The first milestone\n", "", 1), "title"},
		{"a facing entry with no line", strings.Replace(goodBet, "    line: The verb prints a table.\n", "", 1), "line"},
		{"a deferral with no reason",
			strings.Replace(goodBet, "    reason: The board lands in a later slice.\n", "", 1), "reason"},
		{"an absolute design path", strings.Replace(goodBet, "  - docs/design.md", "  - /etc/design.md", 1), "absolute"},
		{"a slice entry with no milestone", strings.Replace(goodBet, "    milestone: demo_m1\n", "", 1), "milestone"},
		{"a premise that is not an id",
			strings.Replace(goodBet, "design:\n", "premises:\n  - Seal/One\ndesign:\n", 1), "premises"},
	}
	for _, c := range betCases {
		t.Run("bet/"+c.name, func(t *testing.T) {
			_, err := ParseBet(betPath, []byte(c.content))
			if err == nil {
				t.Fatalf("the parser accepted %s", c.name)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the parser said %q, and it does not name %q", err.Error(), c.want)
			}
		})
	}
}

// --- ids ------------------------------------------------------------------

// secondSlice puts a second slice file beside the first and lists it in the
// bet. It is built from the first slice with the replacements the caller
// gives, so a case can decide what the two slices share.
func secondSlice(files map[string]string, pairs ...string) {
	files[betPath] = strings.Replace(files[betPath],
		"  - id: demo_s1\n    milestone: demo_m1\n",
		"  - id: demo_s1\n    milestone: demo_m1\n  - id: demo_s2\n    milestone: demo_m1\n", 1)

	files["docs/plan/demo/demo_bet/demo_s2.md"] = strings.NewReplacer(pairs...).Replace(goodSlice)
}

// TestProof_b3s1_ids_are_unique_across_the_repo holds R1's second sentence. An
// id is one thing's name, and two things wearing it makes every reference to it
// a guess.
// Contract: docs/derivation-contract.md section 1.
func TestProof_b3s1_ids_are_unique_across_the_repo(t *testing.T) {
	cases := []struct {
		name   string
		break_ func(map[string]string)
		want   string
	}{
		{
			"two proofs with one id",
			func(f map[string]string) {
				// The second slice has its own id and its own file, and it
				// carries the first slice's proof id.
				secondSlice(f, "id: demo_s1", "id: demo_s2")
			},
			"demo_p1",
		},
		{
			"a milestone wearing the bet's id",
			func(f map[string]string) {
				f[betPath] = strings.NewReplacer(
					"id: demo_m1", "id: demo_bet",
					"milestone: demo_m1", "milestone: demo_bet",
				).Replace(goodBet)
				f[slicePath] = strings.Replace(goodSlice, "milestone: demo_m1", "milestone: demo_bet", 1)
			},
			"demo_bet",
		},
		{
			"a proof wearing a facing id",
			func(f map[string]string) {
				f[slicePath] = strings.NewReplacer(
					"id: demo_p1", "id: demo_f1",
					"TestProof_demo_p1_", "TestProof_demo_f1_",
				).Replace(goodSlice)
			},
			"demo_f1",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			files := goodFiles()
			c.break_(files)

			_, err := Load(writeTree(t, files))
			if err == nil {
				t.Fatal("the reader accepted two things wearing one id")
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the reader said %q, and it does not name %q", err.Error(), c.want)
			}
		})
	}
}

// The directory a unit sits in has to spell the same id the file declares. Two
// spellings of one name is D28's rule, and here it also decides which file a
// reference reaches.
func TestThePathAndTheIDMustAgree(t *testing.T) {
	cases := []struct{ name, from, to, want string }{
		{"a program directory", "docs/plan/demo/", "docs/plan/other/", "other"},
		{"a bet directory", "docs/plan/demo/demo_bet/", "docs/plan/demo/other_bet/", "other_bet"},
		{"a slice file", "demo_bet/demo_s1.md", "demo_bet/other_s1.md", "other_s1"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			files := map[string]string{}
			for rel, content := range goodFiles() {
				files[strings.Replace(rel, c.from, c.to, 1)] = content
			}

			_, err := Load(writeTree(t, files))
			if err == nil {
				t.Fatal("the reader accepted a unit whose path and id disagree")
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the reader said %q, and it does not name %q", err.Error(), c.want)
			}
		})
	}
}

// --- references -----------------------------------------------------------

// TestProof_b3s1_references_resolve_or_the_reader_names_them is the resolver's
// own table. Every reference a plan file makes has to reach something, and the
// error has to say which one did not.
// Contract: docs/derivation-contract.md section 1.
func TestProof_b3s1_references_resolve_or_the_reader_names_them(t *testing.T) {
	cases := []struct{ name, rel, from, to, want string }{
		{
			"a slice naming a milestone its bet does not hold",
			slicePath, "milestone: demo_m1", "milestone: demo_m9", "demo_m9",
		},
		{
			"a slice naming a bet that is not its own",
			slicePath, "bet: demo_bet", "bet: demo_other", "demo_other",
		},
		{
			"a bet naming a program nobody wrote",
			betPath, "program: demo\n", "program: demo_missing\n", "demo_missing",
		},
		{
			"a bet listing a slice with no file",
			betPath, "  - id: demo_s1\n    milestone: demo_m1\n",
			"  - id: demo_s1\n    milestone: demo_m1\n  - id: demo_s9\n    milestone: demo_m1\n", "demo_s9",
		},
		{
			"a bet putting a slice on a milestone it does not hold",
			betPath, "  - id: demo_s1\n    milestone: demo_m1\n",
			"  - id: demo_s1\n    milestone: demo_m9\n", "demo_m9",
		},
		{
			"a bet listing one slice twice",
			betPath, "  - id: demo_s1\n    milestone: demo_m1\n",
			"  - id: demo_s1\n    milestone: demo_m1\n  - id: demo_s1\n    milestone: demo_m1\n", "demo_s1",
		},
		{
			"a bet whose design path names no file",
			betPath, "  - docs/design.md", "  - docs/nothing-here.md", "docs/nothing-here.md",
		},
		{
			"a deferral of a facing id nobody declared",
			betPath, "  - id: demo_f2\n    reason:", "  - id: demo_f9\n    reason:", "demo_f9",
		},
		{
			"a slice claiming a facing id its bet does not declare",
			slicePath, "  - demo_f1", "  - demo_f9", "demo_f9",
		},
		{
			// D61 ruling 3: a doubled declaration is refused here, where every
			// other doubled declaration is refused. Read further on, one slice
			// claiming one item twice is a traceability red naming one slice
			// twice, which tells a reader nothing.
			"a slice claiming one facing id twice",
			slicePath, "  - demo_f1", "  - demo_f1\n  - demo_f1", "demo_f1",
		},
		{
			"a slice declaring one record twice",
			slicePath, "  - docs/derivation-contract.md",
			"  - docs/derivation-contract.md\n  - docs/derivation-contract.md",
			"declares the record docs/derivation-contract.md twice",
		},
		{
			"a proof from a design file that is not there",
			slicePath, "from: docs/design.md#one", "from: docs/gone.md#one", "docs/gone.md",
		},
		{
			"a bet the program's ladder never names",
			programPath, "  - id: demo_bet", "  - id: demo_unlisted", "demo_bet",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			files := goodFiles()
			broken := strings.Replace(files[c.rel], c.from, c.to, 1)
			if broken == files[c.rel] {
				t.Fatalf("the case did not change %s, so it proves nothing", c.rel)
			}
			files[c.rel] = broken

			_, err := Load(writeTree(t, files))
			if err == nil {
				t.Fatal("the reader accepted a reference that does not resolve")
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the reader said %q, and it does not name %q", err.Error(), c.want)
			}
		})
	}
}

// A bet belongs to the program whose directory it sits in. This is the bet's
// half of the rule a slice is already held to: the file's place decides, and
// the field has to agree with it. Without it a bet can declare a program that
// exists, is on that program's ladder, and is not the one it sits under.
func TestABetBelongsToTheProgramItSitsUnder(t *testing.T) {
	files := goodFiles()

	// A second program, whose ladder is the one naming demo_bet. The first
	// program's ladder gives demo_bet up, so exactly one ladder names it and
	// the only thing wrong is where the bet file sits.
	files["docs/plan/other/program.md"] = strings.NewReplacer(
		"id: demo\n", "id: other\n",
		"id: demo_later", "id: other_later",
	).Replace(goodProgram)
	files[programPath] = strings.Replace(goodProgram,
		"  - id: demo_bet\n    line: The only bet with files of its own.\n"+
			"    proof_sketch: The reader parses its bet file and its slice file.\n", "", 1)
	files[betPath] = strings.Replace(goodBet, "program: demo", "program: other", 1)

	_, err := Load(writeTree(t, files))
	if err == nil {
		t.Fatal("the reader accepted a bet that does not sit under the program it names")
	}
	for _, want := range []string{"names the program other", "sits in the directory of demo"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("the reader said %q, and it does not say %q", err.Error(), want)
		}
	}
}

// A bet sits at one place on one ladder. Twice on one ladder is two positions
// in one order, and the order is what "next" means. On two ladders is a bet
// that belongs to two programs.
func TestABetSitsAtOnePlaceOnOneLadder(t *testing.T) {
	const cutEntry = "  - id: demo_bet\n    line: The only bet with files of its own.\n" +
		"    proof_sketch: The reader parses its bet file and its slice file.\n"

	const laterEntry = "  - id: demo_later\n    line: A later bet, one line and no files yet.\n" +
		"    proof_sketch: Nothing is written for it until it is next.\n"

	cases := []struct {
		name   string
		break_ func(map[string]string)
		want   string
	}{
		{
			"one bet listed twice on one ladder",
			func(f map[string]string) {
				f[programPath] = strings.Replace(goodProgram, cutEntry, cutEntry+cutEntry, 1)
			},
			"lists the bet demo_bet twice on its ladder",
		},
		{
			"one bet on the ladders of two programs",
			func(f map[string]string) {
				f["docs/plan/other/program.md"] = strings.NewReplacer(
					"id: demo\n", "id: other\n",
					laterEntry, "",
				).Replace(goodProgram)
			},
			"and a bet belongs to one program",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			files := goodFiles()
			c.break_(files)

			_, err := Load(writeTree(t, files))
			if err == nil {
				t.Fatal("the reader accepted a bet sitting at two places on the ladders")
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Errorf("the reader said %q, and it does not say %q", err.Error(), c.want)
			}
		})
	}
}

// A ladder entry naming a bet nobody has cut yet is the only place that id is
// written down, so it holds the id against everything else in the repo. A
// milestone wearing it would make every mention of that id a guess.
func TestALadderEntryWithNoFilesStillHoldsItsID(t *testing.T) {
	files := goodFiles()
	files[betPath] = strings.NewReplacer(
		"id: demo_m1", "id: demo_later",
		"milestone: demo_m1", "milestone: demo_later",
	).Replace(goodBet)
	files[slicePath] = strings.Replace(goodSlice, "milestone: demo_m1", "milestone: demo_later", 1)

	_, err := Load(writeTree(t, files))
	if err == nil {
		t.Fatal("the reader accepted a milestone wearing a ladder entry's id")
	}
	if !strings.Contains(err.Error(), "demo_later") {
		t.Errorf("the reader said %q, and it does not name the id worn twice", err.Error())
	}
	if !strings.Contains(err.Error(), "an id names one thing") {
		t.Errorf("the reader said %q, and it does not say why that is refused", err.Error())
	}
}

// R9 joins a test result to a proof through the test's name, so one name must
// answer for one proof. Two proofs may not name one marker, and no proof id may
// open with another proof id and an underscore — TestProof_a_b_runs opens with
// the marker prefix of the proof a and with that of the proof a_b.
func TestOneTestNameAnswersForOneProof(t *testing.T) {
	second := func(id, marker string) string {
		return sliceProofs + "  - id: " + id + "\n    marker: " + marker + "\n" +
			"    from: docs/design.md#one\n    headline: false\n    retire_at_close: false\n"
	}

	cases := []struct{ name, content, want string }{
		{
			"two proofs naming one marker",
			strings.Replace(
				strings.Replace(goodSlice, sliceProofs, second("demo_p1_x", "TestProof_demo_p1_x_runs"), 1),
				"TestProof_demo_p1_the_table_prints", "TestProof_demo_p1_x_runs", 1),
			"both name the marker",
		},
		{
			"a proof id opening with another proof id",
			strings.Replace(goodSlice, sliceProofs, second("demo_p1_x", "TestProof_demo_p1_x_runs"), 1),
			"opens with the proof demo_p1",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := loadBroken(t, slicePath, c.content)
			if !strings.Contains(got, c.want) {
				t.Errorf("the reader said %q, and it does not say %q", got, c.want)
			}
		})
	}
}

// The optional fields really are optional. A plan that leaves out every one of
// them at once still reads, so any one of them becoming required shows up here.
//
// The page says which fields may be left out (F44b), and this is the half that
// holds the page's claim to the parser.
func TestEveryOptionalFieldMayBeLeftOut(t *testing.T) {
	const bareBet = `---
id: demo_bet
title: The demo bet
program: demo
design:
  - docs/design.md
` + betMilestones + betSlices + `---

Prose.
`

	const bareSlice = `---
id: demo_s1
bet: demo_bet
milestone: demo_m1
` + sliceProofs + `fixtures:
  - an empty table and a full one
real:
  - the parser
faked: []
---

Prose.
`

	// Nothing in the bare files carries premises, facing, deferred, records or
	// a data block, so the fixture is the claim.
	for shape, fields := range optionalFields() {
		for _, field := range fields {
			for _, content := range []string{bareBet, bareSlice} {
				if strings.Contains(content, "\n"+field+":") {
					t.Fatalf("the bare fixture still writes %s.%s, so it proves nothing about it", shape, field)
				}
			}
		}
	}

	files := goodFiles()
	files[betPath] = bareBet
	files[slicePath] = bareSlice

	set, err := Load(writeTree(t, files))
	if err != nil {
		t.Fatalf("a plan leaving out every optional field did not load: %v", err)
	}

	bet := set.Bets[0]
	if len(bet.Premises) != 0 || len(bet.Facing) != 0 || len(bet.Deferred) != 0 {
		t.Errorf("the bare bet read premises=%v facing=%v deferred=%v", bet.Premises, bet.Facing, bet.Deferred)
	}

	slice := set.Slices[0]
	if len(slice.Facing) != 0 || len(slice.Records) != 0 || slice.Data != nil {
		t.Errorf("the bare slice read facing=%v records=%v data=%+v", slice.Facing, slice.Records, slice.Data)
	}
}

// The other half: a field not on the optional list may not be left out. Without
// this, a required field quietly becoming optional would read as a plan that
// declares less than it must, and nothing would say so.
func TestAFieldOffTheOptionalListMayNotBeLeftOut(t *testing.T) {
	optional := map[string]bool{}
	for shape, fields := range optionalFields() {
		for _, field := range fields {
			optional[shape+"."+field] = true
		}
	}

	// Each entry takes one whole field out of the fixture, its indented lines
	// included.
	cases := []struct{ shape, field, cut string }{
		{"bet", "id", "id: demo_bet\n"},
		{"bet", "title", "title: The demo bet\n"},
		{"bet", "program", "program: demo\n"},
		{"bet", "design", "design:\n  - docs/design.md\n"},
		{"bet", "milestones", betMilestones},
		{"bet", "slices", betSlices},
		{"slice plan", "id", "id: demo_s1\n"},
		{"slice plan", "bet", "bet: demo_bet\n"},
		{"slice plan", "milestone", "milestone: demo_m1\n"},
		{"slice plan", "proofs", sliceProofs},
		{"slice plan", "fixtures", "fixtures:\n  - an empty table and a full one\n"},
		{"slice plan", "real", "real:\n  - the parser\n"},
		{"slice plan", "faked", "faked: []\n"},
	}

	// Every required field of both shapes has a case, or a field could drop off
	// this table and out of the parser together.
	covered := map[string]bool{}
	for _, c := range cases {
		covered[c.shape+"."+c.field] = true
	}
	for _, shape := range []string{"bet", "slice plan"} {
		for _, field := range fieldNames()[shape] {
			if !optional[shape+"."+field] && !covered[shape+"."+field] {
				t.Errorf("the parser reads %s.%s, it is not on the optional list, and no case leaves it out",
					shape, field)
			}
		}
	}

	for _, c := range cases {
		t.Run(c.shape+"/"+c.field, func(t *testing.T) {
			whole, at := goodBet, betPath
			if c.shape == "slice plan" {
				whole, at = goodSlice, slicePath
			}

			broken := strings.Replace(whole, c.cut, "", 1)
			if broken == whole {
				t.Fatalf("the case did not change %s, so it proves nothing", at)
			}

			got := loadBroken(t, at, broken)
			if !strings.Contains(got, c.field) {
				t.Errorf("the reader said %q, and it does not name the field that was left out", got)
			}
		})
	}
}

// The ladder's later bets are one-line sketches, not files. Resolving them
// would make the program file impossible to write, because only the next bet is
// designed in full.
func TestALadderEntryWithNoFilesIsFine(t *testing.T) {
	set, err := Load(writeTree(t, goodFiles()))
	if err != nil {
		t.Fatalf("the fixture did not load: %v", err)
	}

	var found bool
	for _, entry := range set.Programs[0].Ladder {
		if entry.ID == "demo_later" {
			found = true
		}
	}
	if !found {
		t.Fatal("the ladder's later bet was dropped")
	}
}

// A slice file nobody listed is a plan that misstates itself in the other
// direction: work planned, and a bet that does not know about it.
func TestASliceFileNoBetListsIsNamed(t *testing.T) {
	files := goodFiles()
	files["docs/plan/demo/demo_bet/demo_s2.md"] = strings.NewReplacer(
		"id: demo_s1", "id: demo_s2",
		"id: demo_p1", "id: demo_p2",
		"TestProof_demo_p1_the_table_prints", "TestProof_demo_p2_the_table_prints",
	).Replace(goodSlice)

	_, err := Load(writeTree(t, files))
	if err == nil {
		t.Fatal("the reader accepted a slice file no bet lists")
	}
	if !strings.Contains(err.Error(), "demo_s2") {
		t.Errorf("the reader said %q, and it does not name the unlisted slice", err.Error())
	}
}

// One broken file does not end the read. A reader that stopped at the first
// problem would hand back one line at a time, and the next run would find the
// next one — so every problem is collected and the count is said out loud.
//
// The count is written before the first problem, not after it. A line of
// evidence is cut from the end, and D33 rules that words give way and counts
// never do. Move the count to the tail and a long path takes it with it.
func TestTheCountIsSaidBeforeTheFirstProblem(t *testing.T) {
	files := goodFiles()
	files[slicePath] = strings.Replace(goodSlice, "milestone: demo_m1", "milestone: demo_m9", 1)
	files[betPath] = strings.Replace(goodBet, "  - docs/design.md", "  - docs/nothing-here.md", 1)

	_, err := Load(writeTree(t, files))
	if err == nil {
		t.Fatal("the reader accepted two broken files")
	}
	if !strings.HasPrefix(err.Error(), "2 problems, the first: ") {
		t.Errorf("the reader said %q, and it does not open with the count of the problems it found", err.Error())
	}

	one := loadBroken(t, slicePath, strings.Replace(goodSlice, "milestone: demo_m1", "milestone: demo_m9", 1))
	if !strings.HasPrefix(one, "1 problem: ") {
		t.Errorf("the reader said %q, and it does not open with the count", one)
	}
}

// --- the tree itself ------------------------------------------------------

// A plan directory has one shape, and a file in the wrong place is a file
// nothing reads. Silence there is the failure this repo keeps meeting.
//
// Each case names the file and the rule's own words. Naming the file alone is
// not enough: take the rule out and the file lands somewhere else that also
// refuses it by name, and the case passes over a rule that is gone (F-L2).
func TestTheTreeShapeIsHeldTo(t *testing.T) {
	cases := []struct {
		name   string
		break_ func(map[string]string)
		want   []string
	}{
		{
			"a bet directory with no bet file",
			func(f map[string]string) { delete(f, betPath) },
			[]string{"docs/plan/demo/demo_bet", "holds no bet.md"},
		},
		{
			"a stray file beside the programs",
			func(f map[string]string) { f["docs/plan/notes.md"] = "# notes\n" },
			[]string{"notes.md", "holds one directory per program"},
		},
		{
			"a stray file beside a program file",
			func(f map[string]string) { f["docs/plan/demo/notes.md"] = "# notes\n" },
			[]string{"notes.md", "a program directory holds program.md and one directory per bet"},
		},
		{
			"a directory below a bet",
			func(f map[string]string) { f["docs/plan/demo/demo_bet/deeper/x.md"] = "# x\n" },
			[]string{"deeper", "is a directory, and a bet directory holds bet.md and one file per slice"},
		},
		{
			"a file below a bet that is not markdown",
			func(f map[string]string) { f["docs/plan/demo/demo_bet/notes.txt"] = "notes\n" },
			[]string{"notes.txt", "one .md file per slice"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			files := goodFiles()
			c.break_(files)

			_, err := Load(writeTree(t, files))
			if err == nil {
				t.Fatalf("the reader accepted %s", c.name)
			}
			for _, want := range c.want {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("the reader said %q, and it does not say %q", err.Error(), want)
				}
			}
		})
	}
}

// D45: "Only a docs/plan that offers nothing to parse has nothing to
// misstate." The line is whether the walk met a plan file at all — of any of
// the three kinds. None of them is unrunnable, and the answer names what the
// directory held instead. One of them is a plan, and everything wrong with it
// is red, the missing files included.
//
// F43 is why the count is not program files alone. A whole bet with its slices
// under a directory missing its program.md counted as nothing to parse, so it
// read as unrunnable — and unrunnable never fails a run.
func TestNothingToParseIsUnrunnableAndAPlanFileMakesItRed(t *testing.T) {
	cases := []struct {
		name     string
		files    func() map[string]string
		dirs     []string
		noUnits  bool
		wantSaid []string
	}{
		{
			name:     "a plan directory holding one file and no program directory",
			files:    func() map[string]string { return map[string]string{"docs/plan/README.md": "# plans go here\n"} },
			noUnits:  true,
			wantSaid: []string{"README.md", "holds one directory per program"},
		},
		{
			name:     "a program directory with nothing at all beneath it",
			files:    func() map[string]string { return map[string]string{} },
			dirs:     []string{"docs/plan/demo"},
			noUnits:  true,
			wantSaid: []string{"docs/plan/demo", "holds no program.md"},
		},
		{
			name: "a bet directory with nothing at all beneath it",
			files: func() map[string]string {
				return map[string]string{}
			},
			dirs:     []string{"docs/plan/demo/demo_bet"},
			noUnits:  true,
			wantSaid: []string{"holds no bet.md"},
		},
		{
			name: "a program directory with no program.md above a real bet",
			files: func() map[string]string {
				files := goodFiles()
				delete(files, programPath)

				return files
			},
			noUnits:  false,
			wantSaid: []string{"docs/plan/demo", "holds no program.md"},
		},
		{
			name: "a bet directory holding one slice file and no bet.md",
			files: func() map[string]string {
				files := goodFiles()
				delete(files, betPath)

				return files
			},
			noUnits:  false,
			wantSaid: []string{"docs/plan/demo/demo_bet", "holds no bet.md"},
		},
		{
			// One slice file and nothing else. It is the only plan file in the
			// tree, so it is what makes this red rather than unrunnable — the
			// purest case for the slice-file half of the count.
			name: "one slice file, with no bet.md and no program.md above it",
			files: func() map[string]string {
				return map[string]string{slicePath: goodSlice}
			},
			noUnits:  false,
			wantSaid: []string{"docs/plan/demo/demo_bet", "holds no bet.md"},
		},
		{
			name: "a stray file beside a program that does parse",
			files: func() map[string]string {
				files := goodFiles()
				files["docs/plan/notes.md"] = "# notes\n"

				return files
			},
			noUnits:  false,
			wantSaid: []string{"notes.md"},
		},
		{
			name: "a program.md that is there and will not parse",
			files: func() map[string]string {
				files := goodFiles()
				files[programPath] = "# no frontmatter here\n"

				return files
			},
			noUnits:  false,
			wantSaid: []string{"frontmatter"},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			root := writeTree(t, c.files())
			for _, dir := range c.dirs {
				if err := os.MkdirAll(filepath.Join(root, filepath.FromSlash(dir)), 0o750); err != nil {
					t.Fatalf("could not make %s: %v", dir, err)
				}
			}

			_, err := Load(root)
			if err == nil {
				t.Fatalf("the reader accepted %s", c.name)
			}
			if got := errors.Is(err, ErrNoUnits); got != c.noUnits {
				t.Errorf("the reader said %q, and it read as nothing-to-parse=%v, want %v",
					err.Error(), got, c.noUnits)
			}
			for _, want := range c.wantSaid {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("the reader said %q, and it does not say %q", err.Error(), want)
				}
			}
		})
	}
}

// The program-file half of the counter, pinned alone. A program.md with no
// bets cut yet is the first state of every new plan, and it is the one shape
// only walkProgram's own increment can count. Without it, a real, readable
// plan reads as nothing to parse.
func TestAProgramFileAloneIsAPlanNotNothing(t *testing.T) {
	root := writeTree(t, map[string]string{programPath: goodProgram})

	set, err := Load(root)
	if err != nil {
		t.Fatalf("the reader refused a plan holding one program file: %v", err)
	}
	if len(set.Programs) != 1 || len(set.Bets) != 0 || len(set.Slices) != 0 {
		t.Errorf("read %d programs, %d bets, %d slices, want 1, 0, 0",
			len(set.Programs), len(set.Bets), len(set.Slices))
	}
}

// F43's own pair, as the closure check built it. Two repos alike but for one
// file: the same bet, the same slice, the same misstatement — a slice on a
// milestone its bet does not hold — with program.md and without it. Both are
// red. The one without it also names the file that is missing.
//
// Before the fix the second repo read unrunnable, and unrunnable never fails a
// run, so deleting one file made the misstatement stop being reported.
func TestDeletingTheProgramFileDoesNotSilenceTheMisstatementBelowIt(t *testing.T) {
	misstating := func() map[string]string {
		files := goodFiles()
		files[slicePath] = strings.Replace(goodSlice, "milestone: demo_m1", "milestone: demo_m9", 1)

		return files
	}

	_, err := Load(writeTree(t, misstating()))
	if err == nil {
		t.Fatal("the reader accepted a slice on a milestone its bet does not hold")
	}
	if !strings.Contains(err.Error(), "demo_m9") {
		t.Fatalf("the reader said %q, and it does not name the milestone nobody holds", err.Error())
	}
	if errors.Is(err, ErrNoUnits) {
		t.Fatal("a complete plan read as nothing to parse")
	}

	without := misstating()
	delete(without, programPath)

	_, err = Load(writeTree(t, without))
	if err == nil {
		t.Fatal("deleting the program file made the whole plan read clean")
	}
	if errors.Is(err, ErrNoUnits) {
		t.Fatalf("the reader said %q, and a bet with its slices is something to parse", err.Error())
	}
	if !strings.Contains(err.Error(), "holds no program.md") {
		t.Errorf("the reader said %q, and it does not name the file that is missing", err.Error())
	}

	// The line prints the first problem and counts the rest, so the
	// misstatement below the missing file shows up in the count. A line saying
	// one problem would mean everything under the bet went unread.
	if !strings.Contains(err.Error(), " problems, the first: ") {
		t.Errorf("the reader said %q, and it found nothing wrong beyond the missing file", err.Error())
	}
}

// A repo with no plan directory has no plans to misstate, and the reader says
// exactly that rather than inventing a failure.
func TestARepoWithNoPlanDirectorySaysSo(t *testing.T) {
	_, err := Load(t.TempDir())
	if !errors.Is(err, ErrNoPlanDir) {
		t.Fatalf("a repo with no %s read as %v", Dir, err)
	}
}

// A plan directory holding no unit is not a pass. D17: a verifier may never
// pass on nothing, and an empty plan directory is somebody halfway through
// writing one.
func TestAPlanDirectoryHoldingNoUnitSaysSo(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, filepath.FromSlash(Dir)), 0o750); err != nil {
		t.Fatalf("could not make the plan directory: %v", err)
	}

	_, err := Load(root)
	if !errors.Is(err, ErrNoUnits) {
		t.Fatalf("an empty %s read as %v", Dir, err)
	}
	if errors.Is(err, ErrNoPlanDir) {
		t.Fatal("an empty plan directory read as a missing one")
	}
}

// The two sentinels are different answers to different questions, and a caller
// that cannot tell them apart cannot tell green from unrunnable.
func TestTheTwoSentinelsAreDistinct(t *testing.T) {
	if errors.Is(ErrNoUnits, ErrNoPlanDir) || errors.Is(ErrNoPlanDir, ErrNoUnits) {
		t.Fatal("the missing-directory and empty-directory sentinels are the same error")
	}
}

// A load error names the file the reader was reading, from the repo root, and
// never from the machine it ran on. The reader's next move is to open the file,
// and a temporary directory in the message says nothing to them.
func TestEveryErrorNamesItsFileFromTheRepoRoot(t *testing.T) {
	got := loadBroken(t, slicePath, "---\nid: demo_s1\n---\n")
	if !strings.Contains(got, slicePath) {
		t.Errorf("the reader said %q, and it does not name the file it read", got)
	}
	if strings.Contains(got, os.TempDir()) {
		t.Errorf("the reader said %q, and it carries a path from the machine it ran on", got)
	}
}

// --- the contract page ----------------------------------------------------

// contractSections says which numbered section of the derivation contract
// writes each shape's fields down. The check is per section rather than per
// page, so a field named under the wrong shape does not count as named.
var contractSections = map[string]string{
	"program":      "### 1.3",
	"ladder entry": "### 1.3",
	"bet":          "### 1.4",
	"milestone":    "### 1.4",
	"bet slice":    "### 1.4",
	"facing item":  "### 1.4",
	"deferral":     "### 1.4",
	"slice plan":   "### 1.5",
	"proof":        "### 1.5",
	"data block":   "### 1.5",
}

// sectionBody returns the text of the section opening with head, up to the next
// heading at the same level or above.
func sectionBody(page, head string) string {
	at := strings.Index(page, head)
	if at < 0 {
		return ""
	}

	rest := page[at+len(head):]
	for _, next := range []string{"\n### ", "\n## "} {
		if end := strings.Index(rest, next); end >= 0 {
			rest = rest[:end]
		}
	}

	return rest
}

// TestProof_b3s1_contract_names_every_field_the_parser_reads is R17's half of
// this slice: the derivation contract is written in the same commit as the
// parser, and every field the parser accepts is on the page. A field the page
// does not name is a field the people who write these files cannot know about.
//
// The field has to appear in its own shape's section, spelled in backticks —
// which is how a field table row and a sentence naming a field are both
// written. A bare search of the whole page passes over a gutted table, because
// id, title, line, from and done are ordinary words that survive anywhere
// (F-L3).
func TestProof_b3s1_contract_names_every_field_the_parser_reads(t *testing.T) {
	page := contractPage(t)
	if !strings.Contains(page, contractSection) {
		t.Fatalf("the derivation contract holds no section titled %q", contractSection)
	}

	for shape, fields := range fieldNames() {
		head, known := contractSections[shape]
		if !known {
			t.Errorf("the parser reads a %s, and this test does not know which section writes it down", shape)

			continue
		}

		body := sectionBody(page, head)
		if body == "" {
			t.Errorf("the derivation contract holds no section opening %q", head)

			continue
		}

		for _, field := range fields {
			if !strings.Contains(body, "`"+field+"`") {
				t.Errorf("the parser reads %s.%s, and section %s never spells it as a field", shape, field, head)
			}
		}
	}

	for _, name := range []string{"program.md", "bet.md", Dir} {
		if !strings.Contains(page, name) {
			t.Errorf("the derivation contract never names %s", name)
		}
	}
}

// The page says "the rules, all of them", so every cap the parser holds
// somebody's file to has to be written there in its own number. A cap nobody
// can read is a refusal that arrives as a surprise. D45 ratified the six as
// built and put them on this page.
func TestTheContractWritesEveryCapTheParserHolds(t *testing.T) {
	page := contractPage(t)
	if !strings.Contains(page, contractSection) {
		t.Fatalf("the derivation contract holds no section titled %q", contractSection)
	}

	caps := []struct{ what, said string }{
		{"a whole plan file", fmt.Sprintf("%d bytes", maxFileBytes)},
		{"one value", fmt.Sprintf("%d bytes", maxScalarBytes)},
		{"an id", fmt.Sprintf("%d bytes", maxIDBytes)},
		{"a path", fmt.Sprintf("%d bytes", maxPathBytes)},
		{"a field name", fmt.Sprintf("%d bytes", maxKeyBytes)},
		{"the nesting", fmt.Sprintf("%d levels", maxDepth)},
	}

	for _, one := range caps {
		if !strings.Contains(page, one.said) {
			t.Errorf("the parser caps %s at %q, and the derivation contract never writes that", one.what, one.said)
		}
	}
}

// The page has to say which fields may be left out, and say it for the same
// fields the parser lets go (F44b). A page that named the required fields and
// stopped leaves the writer guessing at the rest.
func TestTheContractNamesEveryOptionalField(t *testing.T) {
	page := contractPage(t)

	// The shape's own line on the page, found by the file it names.
	lineFor := map[string]string{
		"bet":        "- `bet.md`:",
		"slice plan": "- `<slice>.md`:",
	}

	for shape, fields := range optionalFields() {
		open, known := lineFor[shape]
		if !known {
			t.Errorf("the parser lets a %s leave fields out, and this test does not know its line on the page", shape)

			continue
		}

		var line string
		for _, one := range strings.Split(page, "\n") {
			if strings.HasPrefix(one, open) {
				line = one
			}
		}
		if line == "" {
			t.Errorf("the derivation contract holds no line opening %q, so it never says what a %s may leave out",
				open, shape)

			continue
		}

		for _, field := range fields {
			if !strings.Contains(line, "`"+field+"`") {
				t.Errorf("a %s may leave out %s, and the page's line says %q", shape, field, line)
			}
		}

		// And nothing else. A page that listed a required field as optional
		// would be worse than one that listed nothing.
		for _, field := range fieldNames()[shape] {
			if holds(fields, field) || !strings.Contains(line, "`"+field+"`") {
				continue
			}

			t.Errorf("the page's line says %q, and %s.%s is required", line, shape, field)
		}
	}
}

// contractPage reads the derivation contract from the repo it ships in.
func contractPage(t *testing.T) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", "docs", "derivation-contract.md"))
	if err != nil {
		t.Fatalf("the derivation contract did not read: %v", err)
	}

	return string(raw)
}

// --- this repo's own plan -------------------------------------------------

// TestProof_b3s1_dogfood_this_repos_own_plan_loads is the dogfood. The format has to be
// writable by the people who have to write it, and this repo is the first one
// that had to.
func TestProof_b3s1_dogfood_this_repos_own_plan_loads(t *testing.T) {
	set, err := Load(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("this repo's own plan did not load: %v", err)
	}

	if len(set.Programs) != 1 || set.Programs[0].ID != "rebuild" {
		t.Fatalf("this repo holds %d programs, want the one named rebuild", len(set.Programs))
	}

	var bet *Bet
	for i := range set.Bets {
		if set.Bets[i].ID == "bet_3" {
			bet = &set.Bets[i]
		}
	}
	if bet == nil {
		t.Fatal("this repo's plan holds no bet_3")
	}
	if len(bet.Slices) != 8 {
		t.Errorf("bet 3 plans %d slices, and its design cuts eight", len(bet.Slices))
	}
	if len(bet.Milestones) == 0 {
		t.Error("bet 3 plans no milestones")
	}

	// Every facing id the bet declares is claimed by some slice, or deferred.
	// The row that holds this in both directions lands in slice 6; this only
	// keeps the dogfood honest while it is being written.
	claimed := map[string]bool{}
	for _, slice := range set.Slices {
		for _, id := range slice.Facing {
			claimed[id] = true
		}
	}
	for _, deferral := range bet.Deferred {
		claimed[deferral.ID] = true
	}
	for _, facing := range bet.Facing {
		if !claimed[facing.ID] {
			t.Errorf("bet 3 declares the facing item %s, and no slice claims it", facing.ID)
		}
	}
}
