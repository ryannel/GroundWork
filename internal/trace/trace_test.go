package trace

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
	"github.com/ryannel/groundwork/internal/plan"
	"github.com/ryannel/groundwork/internal/seal"
)

// The fixtures here are whole repos, because two of the three questions this
// package asks are asked of git: which paths a seal covers, and what the
// journal says happened to a seal.

// newRepo makes a git repo with one commit and returns its path.
func newRepo(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
	} {
		runGit(t, dir, args...)
	}

	write(t, dir, "README.md", "start\n")
	commit(t, dir, "README.md")

	return dir
}

// runGit runs one git command in dir and returns its trimmed stdout.
func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, errOut.String())
	}

	return strings.TrimSpace(out.String())
}

// write puts one file at rel inside dir, making the directories above it.
func write(t *testing.T, dir, rel, content string) {
	t.Helper()

	path := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

// commit adds one path and commits it. A seal covers a path git holds.
func commit(t *testing.T, dir, rel string) {
	t.Helper()

	runGit(t, dir, "add", "--", rel)
	runGit(t, dir, "commit", "-m", "add "+rel)
}

// design is the fixture design file every anchor case reads.
const design = `# The design

## R1 — The first ruling (B7)

Words.

## R2 — The second ruling

More words.
`

// setOf builds a plan set the way Load would, with the paths this repo's own
// layout uses. The Report's answers turn on which directory a unit sits in, so
// the fixtures spell that out rather than leaving it to a default.
type fixture struct {
	facing   []plan.Facing
	deferred []plan.Deferral
	premises []string
	slices   []plan.Slice
}

func (f fixture) set() plan.Set {
	return plan.Set{
		Bets: []plan.Bet{{
			Path:     "docs/plan/demo/demo_bet/bet.md",
			ID:       "demo_bet",
			Design:   []string{"docs/design.md"},
			Facing:   f.facing,
			Deferred: f.deferred,
			Premises: f.premises,
		}},
		Slices: f.slices,
	}
}

// oneSlice is a slice of the fixture bet, claiming these facing ids, with one
// proof pointing at the anchor given.
func oneSlice(id, anchor string, facing ...string) plan.Slice {
	return plan.Slice{
		Path:   "docs/plan/demo/demo_bet/" + id + ".md",
		ID:     id,
		Bet:    "demo_bet",
		Facing: facing,
		Proofs: []plan.Proof{{
			ID:     id + "_p",
			Marker: "TestProof_" + id + "_p_it_holds",
			From:   "docs/design.md#" + anchor,
		}},
	}
}

// The slug rule, which is GitHub's: lowercase, punctuation dropped, spaces to
// hyphens, and no runs collapsed — so an em dash between two spaces leaves two
// hyphens behind. M9 computed these by hand against this repo's own design
// file; this is that arithmetic written down where it can be run.
func TestAnchorsAreGitHubsHeadingSlugs(t *testing.T) {
	cases := []struct{ heading, want string }{
		{"# The design", "the-design"},
		{"## R1 — The first ruling (B7)", "r1--the-first-ruling-b7"},
		{"### 1.1 `program.md`", "11-programmd"},
		{"## Two  spaces", "two--spaces"},
		{"## Under_score and dash-es", "under_score-and-dash-es"},
		{"## Trailing hashes ##", "trailing-hashes"},
		// A renderer builds the anchor from the heading's text, and a link's
		// target is not text. Left in, this heading made an anchor holding half a
		// file path, and nobody clicking the heading would ever land on it.
		{"## R12 — [Two-direction traceability](../spec/loop.md#slicing) (B7)", "r12--two-direction-traceability-b7"},
		{"## A [link](x.md) and a [second](y.md)", "a-link-and-a-second"},
		{"##### Deep enough", "deep-enough"},
	}

	for _, c := range cases {
		t.Run(c.heading, func(t *testing.T) {
			got := anchorsIn(c.heading + "\n")
			if !got[c.want] {
				t.Fatalf("the heading %q made %v, and none of them is %q", c.heading, keysOf(got), c.want)
			}
		})
	}
}

// The two shapes that look like a heading and are not one. GitHub makes no
// anchor for either, so neither may make one here: an anchor that resolved
// against a line nobody rendered as a heading would be a reference to nothing.
func TestALineThatIsNotAHeadingMakesNoAnchor(t *testing.T) {
	cases := []struct{ name, line string }{
		{"seven hashes", "####### Too deep"},
		{"no space after the hashes", "##Nospace"},
		{"hashes and nothing else", "###"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := anchorsIn(c.line + "\n"); len(got) > 0 {
				t.Fatalf("the line %q made the anchors %v, and it is not a heading", c.line, keysOf(got))
			}
		})
	}
}

// keysOf renders an anchor set for a failure message.
func keysOf(all map[string]bool) []string {
	var out []string
	for one := range all {
		out = append(out, one)
	}

	return out
}

// GitHub gives the second heading of one name a -1, and this has to follow it:
// an anchor written for the second heading resolves to nothing otherwise.
func TestASecondHeadingOfOneNameTakesASuffix(t *testing.T) {
	got := anchorsIn("## The same\n\n## The same\n\n## The same\n")

	for _, want := range []string{"the-same", "the-same-1", "the-same-2"} {
		if !got[want] {
			t.Errorf("three headings of one name made %v, and none of them is %q", keysOf(got), want)
		}
	}
}

// A # inside a fenced code block is not a heading. A design file that shows a
// markdown example would otherwise make anchors nobody wrote.
func TestAHashInsideAFenceIsNotAHeading(t *testing.T) {
	got := anchorsIn("# Real\n\n```\n# Fake\n```\n\n~~~\n# Also fake\n~~~\n")

	if !got["real"] {
		t.Errorf("the real heading made %v", keysOf(got))
	}
	for _, no := range []string{"fake", "also-fake"} {
		if got[no] {
			t.Errorf("a heading inside a fence made the anchor %q", no)
		}
	}
}

// The backward half. An anchor that names a heading resolves; one that names
// nothing is a problem the report carries, with the proof and the anchor named.
func TestAnAnchorResolvesAgainstTheDesignFileOrIsNamed(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	set := fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
		oneSlice("demo_s2", "r9--a-ruling-nobody-wrote"),
	}}.set()

	rep, err := Check(dir, set)
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if rep.Proofs != 2 {
		t.Errorf("the report counted %d proofs, want 2", rep.Proofs)
	}
	if len(rep.Dangling) != 1 {
		t.Fatalf("the report holds %d dangling anchors, want 1: %+v", len(rep.Dangling), rep.Dangling)
	}
	if !strings.Contains(rep.Dangling[0].Why, "r9--a-ruling-nobody-wrote") {
		t.Errorf("the dangling note says %q, and it does not name the anchor", rep.Dangling[0].Why)
	}
	if !strings.Contains(rep.Dangling[0].Value, "docs/design.md") {
		t.Errorf("the dangling note names %q, and it does not name the file", rep.Dangling[0].Value)
	}
}

// A design file no seal covers is reported, and it is never a dangling anchor:
// the anchor resolved, and what is missing is the seal.
func TestADesignFileNoSealCoversIsNamedApartFromADanglingAnchor(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	rep, err := Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 0 {
		t.Errorf("an anchor that resolves came back dangling: %+v", rep.Dangling)
	}
	if len(rep.UnsealedDesign) != 1 {
		t.Fatalf("the report holds %d unsealed design files, want 1", len(rep.UnsealedDesign))
	}
	if rep.UnsealedDesign[0].Value != "docs/design.md" {
		t.Errorf("the unsealed note names %q, want the design file", rep.UnsealedDesign[0].Value)
	}

	// One note per file, however many proofs point into it.
	rep, err = Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
		oneSlice("demo_s2", "r2--the-second-ruling"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}
	if len(rep.UnsealedDesign) != 1 {
		t.Errorf("two proofs into one file made %d unsealed notes, want 1", len(rep.UnsealedDesign))
	}
}

// A sealed design file is not reported as unsealed. The seal is granted through
// the real verb, so this walks the path a repo with seals actually takes.
func TestASealedDesignFileIsNotCalledUnsealed(t *testing.T) {
	dir := sealedRepo(t, "docs/design.md", "b3_design")

	rep, err := Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.UnsealedDesign) != 0 {
		t.Errorf("a sealed design file came back unsealed: %+v", rep.UnsealedDesign)
	}
}

// The forward half, all four answers at once: claimed once, claimed by two
// slices, claimed by nobody, and deferred with a reason.
func TestEveryFacingIdIsClaimedOnceOrDeferred(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	set := fixture{
		facing: []plan.Facing{
			{ID: "f_once", Line: "Claimed by one slice."},
			{ID: "f_twice", Line: "Claimed by two."},
			{ID: "f_nobody", Line: "Claimed by none."},
			{ID: "f_later", Line: "Deferred."},
		},
		deferred: []plan.Deferral{{ID: "f_later", Reason: "it needs the next bet"}},
		slices: []plan.Slice{
			oneSlice("demo_s1", "r1--the-first-ruling-b7", "f_once", "f_twice"),
			oneSlice("demo_s2", "r2--the-second-ruling", "f_twice"),
		},
	}.set()

	rep, err := Check(dir, set)
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if rep.Facing != 4 {
		t.Errorf("the report counted %d facing ids, want 4", rep.Facing)
	}
	if len(rep.Unclaimed) != 1 || rep.Unclaimed[0].Value != "f_nobody" {
		t.Fatalf("the unclaimed list is %+v, want f_nobody alone", rep.Unclaimed)
	}
	if len(rep.Twice) != 1 || rep.Twice[0].Value != "f_twice" {
		t.Fatalf("the twice list is %+v, want f_twice alone", rep.Twice)
	}
	if !strings.Contains(rep.Twice[0].Why, "demo_s1") || !strings.Contains(rep.Twice[0].Why, "demo_s2") {
		t.Errorf("the twice note says %q, and it does not name both claimants", rep.Twice[0].Why)
	}
}

// A facing item both claimed and deferred is two answers to one question: the
// bet says it does not deliver it and a slice says it does. That is claimed
// twice, and the note says which two records disagree.
func TestAnItemClaimedAndDeferredIsClaimedTwice(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	rep, err := Check(dir, fixture{
		facing:   []plan.Facing{{ID: "f_both", Line: "Both."}},
		deferred: []plan.Deferral{{ID: "f_both", Reason: "left to the next bet"}},
		slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7", "f_both")},
	}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Twice) != 1 || rep.Twice[0].Value != "f_both" {
		t.Fatalf("the twice list is %+v, want f_both alone", rep.Twice)
	}
	if !strings.Contains(rep.Twice[0].Why, "defer") {
		t.Errorf("the note says %q, and it does not say the bet defers it", rep.Twice[0].Why)
	}
	if len(rep.Unclaimed) != 0 {
		t.Errorf("an item that is claimed came back unclaimed: %+v", rep.Unclaimed)
	}
}

// A slice claims for its own bet. A slice in another bet's directory naming the
// same id leaves the item unclaimed, because the plan row is what refuses that
// reference and this row must not read it as a claim.
func TestAClaimFromAnotherBetsDirectoryIsNotAClaim(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	stray := oneSlice("other_s1", "r1--the-first-ruling-b7", "f_once")
	stray.Path = "docs/plan/demo/other_bet/other_s1.md"

	rep, err := Check(dir, fixture{
		facing: []plan.Facing{{ID: "f_once", Line: "Claimed by nobody in this bet."}},
		slices: []plan.Slice{stray},
	}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Unclaimed) != 1 || rep.Unclaimed[0].Value != "f_once" {
		t.Fatalf("the unclaimed list is %+v, want f_once alone", rep.Unclaimed)
	}
}

// sealedRepo makes a repo holding one design seal over one path, granted on a
// green battery run through the real verb.
func sealedRepo(t *testing.T, path, subject string) string {
	t.Helper()

	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-trace")

	write(t, dir, path, design)
	commit(t, dir, path)

	if _, err := journal.WriteBattery(dir, journal.Battery{
		RunID:   "run-20260826T120000Z-abcd",
		Version: "11.0+r1234567",
		Counts: map[string]int{
			"green": 13, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0,
		},
		DurationMS: 1,
	}); err != nil {
		t.Fatalf("could not record a battery run: %v", err)
	}

	if _, err := seal.GrantSeal(dir, seal.Grant{
		Kind: "design", Subject: subject, Paths: []string{path},
	}); err != nil {
		t.Fatalf("granting a seal failed: %v", err)
	}

	return dir
}

// amend moves one seal through the real verb, so the record this package reads
// is the one the tool writes.
func amend(t *testing.T, dir, subject string) {
	t.Helper()

	write(t, dir, "docs/design.md", design+"\n## R3 — A third ruling\n")
	commit(t, dir, "docs/design.md")

	if _, err := seal.AmendSeal(dir, seal.Amendment{
		Kind: "design", Subject: subject, Paths: []string{"docs/design.md"},
		Reason: "the design gained a ruling",
	}); err != nil {
		t.Fatalf("amending %s failed: %v", subject, err)
	}
}

// withdraw writes the revoked half of an amendment and nothing after it. That
// is the dying-amend shape F68 names: the record says the seal was taken back
// and no grant followed.
func withdraw(t *testing.T, dir, subject string) {
	t.Helper()

	tag, err := seal.TagName("design", subject)
	if err != nil {
		t.Fatalf("the tag name did not build: %v", err)
	}

	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: "design", Tag: tag, Action: "revoked",
		Battery: "11.0+r1234567", BatteryRun: "run-20260826T120000Z-abcd",
		Reason: "withdrawn while the design is rewritten",
	}); err != nil {
		t.Fatalf("could not write the revoked line: %v", err)
	}
}

// R13, the whole point: amending an artifact marks every bet whose premises
// name it. The amendment runs through the real verb, so the record this reads
// is the one the tool writes.
func TestAnAmendedArtifactMarksTheBetsThatCiteIt(t *testing.T) {
	dir := sealedRepo(t, "docs/design.md", "b3_design")

	set := fixture{
		premises: []string{"b3_design"},
		slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
	}.set()

	before, err := Check(dir, set)
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}
	if len(before.Marked) != 0 {
		t.Fatalf("a seal nobody moved marked a bet: %+v", before.Marked)
	}
	if len(before.UnsealedPremise) != 0 {
		t.Fatalf("a premise with a seal came back unsealed: %+v", before.UnsealedPremise)
	}
	if before.Premises != 1 {
		t.Errorf("the report counted %d premises, want 1", before.Premises)
	}

	write(t, dir, "docs/design.md", design+"\n## R3 — A third ruling\n")
	commit(t, dir, "docs/design.md")

	if _, err := seal.AmendSeal(dir, seal.Amendment{
		Kind: "design", Subject: "b3_design", Paths: []string{"docs/design.md"},
		Reason: "the design gained a ruling",
	}); err != nil {
		t.Fatalf("amending the seal failed: %v", err)
	}

	after, err := Check(dir, set)
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}
	if len(after.Marked) != 1 {
		t.Fatalf("an amended artifact marked %d bets, want 1: %+v", len(after.Marked), after.Marked)
	}
	if after.Marked[0].Value != "demo_bet" {
		t.Errorf("the mark names %q, want the bet that cites the artifact", after.Marked[0].Value)
	}
	if !strings.Contains(after.Marked[0].Why, "b3_design") {
		t.Errorf("the mark says %q, and it does not name the artifact", after.Marked[0].Why)
	}
	if !strings.Contains(after.Marked[0].Why, "amended") {
		t.Errorf("the mark says %q, and it does not say what happened to the artifact", after.Marked[0].Why)
	}
}

// The other half of R13: an artifact the record says was withdrawn marks the
// bets that cite it too, and the note says withdrawn rather than amended.
func TestAWithdrawnArtifactMarksTheBetsThatCiteIt(t *testing.T) {
	dir := sealedRepo(t, "docs/design.md", "b3_design")
	withdraw(t, dir, "b3_design")

	rep, err := Check(dir, fixture{
		premises: []string{"b3_design"},
		slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
	}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Marked) != 1 {
		t.Fatalf("a withdrawn artifact marked %d bets, want 1: %+v", len(rep.Marked), rep.Marked)
	}
	if !strings.Contains(rep.Marked[0].Why, "withdrawn") {
		t.Errorf("the mark says %q, and it does not say the artifact was withdrawn", rep.Marked[0].Why)
	}
}

// A seal restored into a fresh clone has no journal line behind it: the journal
// is a different ref and it may not have travelled. The tag is still the thing
// the tools read (R5), so the artifact it names is sealed, and a premise on it
// is neither unsealed nor marked.
func TestASealWithNoJournalLineBehindItStillCountsAsSealed(t *testing.T) {
	dir := sealedRepo(t, "docs/design.md", "b3_design")
	runGit(t, dir, "update-ref", "-d", journal.Ref)

	rep, err := Check(dir, fixture{
		premises: []string{"b3_design"},
		slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
	}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.UnsealedPremise) != 0 {
		t.Errorf("a premise whose tag is right there came back unsealed: %+v", rep.UnsealedPremise)
	}
	if len(rep.UnsealedDesign) != 0 {
		t.Errorf("a design file whose tag is right there came back unsealed: %+v", rep.UnsealedDesign)
	}
	if len(rep.Marked) != 0 {
		t.Errorf("a seal nobody moved marked a bet: %+v", rep.Marked)
	}
}

// A premise naming an artifact no seal covers is not a mark and not a red. It
// is the unsealed state, counted apart, on R4's own ground: in this environment
// there is no key the agents cannot read, so a missing seal is loud and never
// blocking until that flips.
func TestAPremiseWithNoSealIsUnsealedRatherThanMarked(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	rep, err := Check(dir, fixture{
		premises: []string{"b3_design"},
		slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
	}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Marked) != 0 {
		t.Fatalf("a premise nobody sealed marked a bet: %+v", rep.Marked)
	}
	if len(rep.UnsealedPremise) != 1 || rep.UnsealedPremise[0].Value != "b3_design" {
		t.Fatalf("the unsealed premises are %+v, want b3_design alone", rep.UnsealedPremise)
	}
}

// A bet standing on two amended artifacts is one marked bet, not two. The count
// is of bets, because a bet is what a reader has to go and re-read.
func TestABetIsMarkedOnceHoweverManyOfItsPremisesMoved(t *testing.T) {
	dir := sealedRepo(t, "docs/design.md", "b3_design")

	write(t, dir, "docs/second.md", design)
	commit(t, dir, "docs/second.md")

	if _, err := seal.GrantSeal(dir, seal.Grant{
		Kind: "design", Subject: "b3_second", Paths: []string{"docs/second.md"},
	}); err != nil {
		t.Fatalf("granting the second seal failed: %v", err)
	}

	for _, subject := range []string{"b3_design", "b3_second"} {
		if _, err := seal.AmendSeal(dir, seal.Amendment{
			Kind: "design", Subject: subject, Paths: []string{"docs/design.md"},
			Reason: "both moved",
		}); err != nil {
			t.Fatalf("amending %s failed: %v", subject, err)
		}
	}

	rep, err := Check(dir, fixture{
		premises: []string{"b3_design", "b3_second"},
		slices:   []plan.Slice{oneSlice("demo_s1", "r1--the-first-ruling-b7")},
	}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Marked) != 1 {
		t.Fatalf("one bet on two amended artifacts was marked %d times: %+v", len(rep.Marked), rep.Marked)
	}
	if rep.Premises != 2 {
		t.Errorf("the report counted %d premises, want 2", rep.Premises)
	}
}

// A design file that vanished between the plan reader and this one is a
// dangling anchor with the reason named, never a silent pass. The plan reader
// proved the file was there; whatever happened to it since, no anchor resolved.
func TestADesignFileThatCannotBeReadIsNamed(t *testing.T) {
	dir := newRepo(t)

	rep, err := Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 1 {
		t.Fatalf("a design file that is not there gave %d dangling anchors, want 1", len(rep.Dangling))
	}
	if !strings.Contains(rep.Dangling[0].Why, "read") {
		t.Errorf("the note says %q, and it does not say the file could not be read", rep.Dangling[0].Why)
	}
	if !strings.Contains(rep.Dangling[0].Why, "demo_s1_p") {
		t.Errorf("the note says %q, and it does not name the proof left pointing at nothing",
			rep.Dangling[0].Why)
	}

	// A note is read on a machine that is not the one that wrote it, so the
	// directory the operating system puts in front of its reason says nothing
	// there. What is kept is the reason.
	if strings.Contains(rep.Dangling[0].Why, dir) || strings.Contains(rep.Dangling[0].Why, os.TempDir()) {
		t.Errorf("the note says %q, and it carries a path from the machine it ran on", rep.Dangling[0].Why)
	}
}

// F94: a design file is a file any commit can grow, and an uncapped read is one
// committed file away from taking the whole battery down. The row refuses to
// read past the cap and says so, naming the file and the number.
func TestADesignFileOverTheCapIsRefusedAndNamed(t *testing.T) {
	dir := newRepo(t)

	big := filepath.Join(dir, "docs", "design.md")
	if err := os.MkdirAll(filepath.Dir(big), 0o750); err != nil {
		t.Fatalf("could not make the design directory: %v", err)
	}

	// Sparse, so the case costs no disk and no memory: the row refuses it on its
	// size and never reads a byte of it.
	f, err := os.Create(big)
	if err != nil {
		t.Fatalf("could not make the big file: %v", err)
	}
	if err := f.Truncate(400 << 20); err != nil {
		f.Close()
		t.Fatalf("could not grow the big file: %v", err)
	}
	f.Close()

	rep, err := Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 1 {
		t.Fatalf("a design file over the cap gave %d dangling anchors, want 1", len(rep.Dangling))
	}
	for _, want := range []string{
		"over the limit", strconv.Itoa(MaxDesignBytes), strconv.Itoa(400 << 20), "demo_s1_p",
	} {
		if !strings.Contains(rep.Dangling[0].Why, want) {
			t.Errorf("the note says %q, and it does not say %q", rep.Dangling[0].Why, want)
		}
	}
}

// A committed symlink is a path inside the repo pointing wherever it likes, so
// the plan reader's path check does not keep this read inside the repo. This
// does: a design file is read as a file, or it is not read.
func TestADesignFileThatIsASymlinkIsRefusedAndNamed(t *testing.T) {
	dir := newRepo(t)

	if err := os.MkdirAll(filepath.Join(dir, "docs"), 0o750); err != nil {
		t.Fatalf("could not make the design directory: %v", err)
	}
	if err := os.Symlink("/dev/zero", filepath.Join(dir, "docs", "design.md")); err != nil {
		t.Skipf("this machine cannot make a symlink: %v", err)
	}

	rep, err := Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 1 {
		t.Fatalf("a symlinked design file gave %d dangling anchors, want 1", len(rep.Dangling))
	}
	if !strings.Contains(rep.Dangling[0].Why, "symlink") {
		t.Errorf("the note says %q, and it does not say why the file was not read", rep.Dangling[0].Why)
	}
}

// A design file that is not a file at all — a named pipe where the prose should
// be — is refused rather than opened. A read of one never returns.
func TestADesignFileThatIsNotARegularFileIsRefused(t *testing.T) {
	dir := newRepo(t)

	path := filepath.Join(dir, "docs", "design.md")
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatalf("could not make the design directory: %v", err)
	}
	if err := exec.Command("mkfifo", path).Run(); err != nil {
		t.Skipf("this machine cannot make a named pipe: %v", err)
	}

	rep, err := Check(dir, fixture{slices: []plan.Slice{
		oneSlice("demo_s1", "r1--the-first-ruling-b7"),
	}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 1 {
		t.Fatalf("a named pipe gave %d dangling anchors, want 1", len(rep.Dangling))
	}
	if !strings.Contains(rep.Dangling[0].Why, "regular file") {
		t.Errorf("the note says %q, and it does not say why the file was not read", rep.Dangling[0].Why)
	}
}

// F98: the last-element check is not the whole defence. A committed symlink at
// an intermediate directory is a path every rule accepts, and the read walks
// straight through it and out of the repo. What holds is the resolved path: a
// design file is read where the repo actually holds it, or it is not read.
func TestADesignFileReachedThroughASymlinkedDirectoryIsRefused(t *testing.T) {
	dir := newRepo(t)

	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret.md"), []byte(design), 0o600); err != nil {
		t.Fatalf("could not write the file outside the repo: %v", err)
	}

	if err := os.MkdirAll(filepath.Join(dir, "docs"), 0o750); err != nil {
		t.Fatalf("could not make the docs directory: %v", err)
	}
	if err := os.Symlink(outside, filepath.Join(dir, "docs", "sub")); err != nil {
		t.Skipf("this machine cannot make a symlink: %v", err)
	}

	slice := oneSlice("demo_s1", "r1--the-first-ruling-b7")
	slice.Proofs[0].From = "docs/sub/secret.md#r1--the-first-ruling-b7"

	rep, err := Check(dir, fixture{slices: []plan.Slice{slice}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 1 {
		t.Fatalf("a design file outside the repo gave %d dangling anchors, want 1: %+v",
			len(rep.Dangling), rep.Dangling)
	}
	if !strings.Contains(rep.Dangling[0].Why, "outside") {
		t.Errorf("the note says %q, and it does not say the read left the repo", rep.Dangling[0].Why)
	}
	if strings.Contains(rep.Dangling[0].Why, outside) {
		t.Errorf("the note says %q, and it carries a path from the machine it ran on", rep.Dangling[0].Why)
	}
}

// The containment rule's own edge: a sibling directory whose name extends the
// root's is outside the repo, though a naive prefix check on the resolved
// paths would call it inside. The Rel-based check is what tells them apart,
// and this case is what keeps a future simplification from reopening F98.
func TestASiblingDirectoryWhoseNameExtendsTheRootsIsOutside(t *testing.T) {
	dir := newRepo(t)

	sibling := dir + "-evil"
	if err := os.MkdirAll(sibling, 0o750); err != nil {
		t.Fatalf("could not make the sibling directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(sibling, "design.md"), []byte(design), 0o600); err != nil {
		t.Fatalf("could not write the sibling's file: %v", err)
	}

	if err := os.MkdirAll(filepath.Join(dir, "docs"), 0o750); err != nil {
		t.Fatalf("could not make the docs directory: %v", err)
	}
	if err := os.Symlink(sibling, filepath.Join(dir, "docs", "sub")); err != nil {
		t.Skipf("this machine cannot make a symlink: %v", err)
	}

	slice := oneSlice("demo_s1", "r1--the-first-ruling-b7")
	slice.Proofs[0].From = "docs/sub/design.md#r1--the-first-ruling-b7"

	rep, err := Check(dir, fixture{slices: []plan.Slice{slice}}.set())
	if err != nil {
		t.Fatalf("the check failed: %v", err)
	}

	if len(rep.Dangling) != 1 {
		t.Fatalf("a sibling directory's file gave %d dangling anchors, want 1: %+v",
			len(rep.Dangling), rep.Dangling)
	}
	if !strings.Contains(rep.Dangling[0].Why, "outside") {
		t.Errorf("the note says %q, and it does not say the read left the repo", rep.Dangling[0].Why)
	}
}

// The other side of the same rule: a design file under real directories reads,
// and it reads whether or not the repo itself is reached through a symlink. A
// containment check that resolved one side and not the other would refuse every
// repo sitting under a symlinked home or a symlinked temporary directory.
func TestADesignFileUnderRealDirectoriesStillReads(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/deep/design.md", design)
	commit(t, dir, "docs/deep/design.md")

	slice := oneSlice("demo_s1", "r1--the-first-ruling-b7")
	slice.Proofs[0].From = "docs/deep/design.md#r1--the-first-ruling-b7"

	set := fixture{slices: []plan.Slice{slice}}.set()

	for _, where := range []struct{ name, root string }{
		{"the repo itself", dir},
		{"the repo through a symlink to it", linkTo(t, dir)},
	} {
		t.Run(where.name, func(t *testing.T) {
			rep, err := Check(where.root, set)
			if err != nil {
				t.Fatalf("the check failed: %v", err)
			}

			if len(rep.Dangling) != 0 {
				t.Fatalf("a design file the repo really holds came back dangling: %+v", rep.Dangling)
			}
			if rep.Proofs != 1 {
				t.Fatalf("the report counted %d proofs, want 1", rep.Proofs)
			}
		})
	}
}

// linkTo returns a path that reaches dir through a symlink, so a test can hand
// the check a root the operating system has to resolve.
func linkTo(t *testing.T, dir string) string {
	t.Helper()

	at := filepath.Join(t.TempDir(), "link")
	if err := os.Symlink(dir, at); err != nil {
		t.Skipf("this machine cannot make a symlink: %v", err)
	}

	return at
}

// The cap's own boundary: a file of exactly the cap reads, and one byte more is
// refused. A cap nobody drives at its edge is a cap that can be off by one.
func TestTheDesignFileCapIsDrivenAtItsBoundary(t *testing.T) {
	for _, one := range []struct {
		name string
		size int
		read bool
	}{
		{"exactly the cap", MaxDesignBytes, true},
		{"one byte over the cap", MaxDesignBytes + 1, false},
	} {
		t.Run(one.name, func(t *testing.T) {
			dir := newRepo(t)

			// The heading first, then filler, so a file that is read has an
			// anchor to resolve and a file that is refused had one to lose.
			body := design + strings.Repeat("\n", one.size-len(design))
			if len(body) != one.size {
				t.Fatalf("the case meant to write %d bytes and wrote %d", one.size, len(body))
			}
			write(t, dir, "docs/design.md", body)

			rep, err := Check(dir, fixture{slices: []plan.Slice{
				oneSlice("demo_s1", "r1--the-first-ruling-b7"),
			}}.set())
			if err != nil {
				t.Fatalf("the check failed: %v", err)
			}

			if one.read && len(rep.Dangling) != 0 {
				t.Fatalf("a file of exactly the cap was refused: %+v", rep.Dangling)
			}
			if !one.read {
				if len(rep.Dangling) != 1 {
					t.Fatalf("a file one byte over the cap gave %d dangling anchors, want 1",
						len(rep.Dangling))
				}
				if !strings.Contains(rep.Dangling[0].Why, "over the limit") {
					t.Errorf("the note says %q, and it does not say what was wrong",
						rep.Dangling[0].Why)
				}
			}
		})
	}
}

// A premise names a seal subject, and the two charsets have to be one rule. They
// are written in two packages, so this is the assertion that holds them
// together: an id one accepts is an id the other accepts, at the boundary and
// past it (F97).
func TestAPremiseIdIsSpelledTheWayASealSubjectIs(t *testing.T) {
	for _, id := range []string{
		"b3_design",
		"a",
		strings.Repeat("a", seal.MaxSubjectBytes),
		strings.Repeat("a", seal.MaxSubjectBytes+1),
		"",
		"B3_design",
		"b3-design",
		"b3.design",
		"b3 design",
	} {
		_, sealTook := seal.SubjectOf("seal/design/" + id)
		planTook := plan.CheckID(id) == nil

		if sealTook != planTook {
			t.Errorf("the id %q: the plan reader takes it %v and the seal takes it %v",
				id, planTook, sealTook)
		}
	}
}

// Check is handed a set, and a proof whose from: holds no path and anchor is
// skipped: not counted, and not blamed for an anchor nobody wrote.
//
// The plan reader refuses that shape long before a row gets here, so this is the
// contract of this function rather than a state a repo can reach through the
// verb. A caller that hands it a set the reader never made gets silence, not a
// dangling anchor.
func TestAProofWhoseFromHoldsNoAnchorIsSkipped(t *testing.T) {
	dir := newRepo(t)
	write(t, dir, "docs/design.md", design)
	commit(t, dir, "docs/design.md")

	for _, from := range []string{"", "docs/design.md", "docs/design.md#", "#r1--the-first-ruling-b7"} {
		t.Run(from, func(t *testing.T) {
			slice := oneSlice("demo_s1", "r1--the-first-ruling-b7")
			slice.Proofs[0].From = from

			rep, err := Check(dir, fixture{slices: []plan.Slice{slice}}.set())
			if err != nil {
				t.Fatalf("the check failed: %v", err)
			}

			if rep.Proofs != 0 {
				t.Errorf("a from: of %q counted %d proofs, want 0", from, rep.Proofs)
			}
			if len(rep.Dangling) != 0 {
				t.Errorf("a from: of %q gave %+v, and there was no anchor to resolve", from, rep.Dangling)
			}
		})
	}
}

// Sound is the row's own question: are any of the three red causes standing.
// The unsealed states and the marks are loud and never red, so neither moves it.
func TestSoundIsFalseOnlyForTheThreeRedCauses(t *testing.T) {
	cases := []struct {
		name string
		rep  Report
		want bool
	}{
		{"nothing wrong", Report{}, true},
		{"a dangling anchor", Report{Dangling: []Note{{Value: "a"}}}, false},
		{"an unclaimed facing id", Report{Unclaimed: []Note{{Value: "a"}}}, false},
		{"a facing id claimed twice", Report{Twice: []Note{{Value: "a"}}}, false},
		{"a marked bet", Report{Marked: []Note{{Value: "a"}}}, true},
		{"an unsealed design file", Report{UnsealedDesign: []Note{{Value: "a"}}}, true},
		{"an unsealed premise", Report{UnsealedPremise: []Note{{Value: "a"}}}, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.rep.Sound(); got != c.want {
				t.Fatalf("Sound() is %v on %s, want %v", got, c.name, c.want)
			}
		})
	}
}

// The dogfood: this repo's own plan, read by this package. A format nobody can
// trace shows up here first.
func TestThisReposOwnPlanTraces(t *testing.T) {
	root := filepath.Join("..", "..")

	set, err := plan.Load(root)
	if err != nil {
		t.Fatalf("this repo's own plan did not load: %v", err)
	}

	rep, err := Check(root, set)
	if err != nil {
		t.Fatalf("the check failed on this repo: %v", err)
	}

	if len(rep.Dangling) > 0 {
		t.Errorf("this repo holds %d dangling anchors: %+v", len(rep.Dangling), rep.Dangling)
	}
	if len(rep.Unclaimed) > 0 {
		t.Errorf("this repo holds %d unclaimed facing ids: %+v", len(rep.Unclaimed), rep.Unclaimed)
	}
	if len(rep.Twice) > 0 {
		t.Errorf("this repo holds %d facing ids claimed twice: %+v", len(rep.Twice), rep.Twice)
	}
	if rep.Proofs == 0 || rep.Facing == 0 {
		t.Errorf("the report read %d proofs and %d facing ids, and this repo declares both",
			rep.Proofs, rep.Facing)
	}
}
