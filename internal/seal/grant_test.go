package seal

import (
	"bytes"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// gitRaw runs one git command and returns its stdout exactly as git wrote it.
// The tag's own bytes are what the mirror stores, so nothing here may trim.
func gitRaw(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)

	var out, errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, errOut.String())
	}

	return out.String()
}

// greenRun records one all-green battery run in the journal and returns its
// run id. A seal is granted on a green run, so every grant fixture needs one.
func greenRun(t *testing.T, dir string) string {
	t.Helper()

	return recordRun(t, dir, "run-20260826T120000Z-abcd", "8.0+r1234567",
		map[string]int{"green": 10, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0})
}

// recordRun writes one battery line into the journal and returns its run id.
func recordRun(t *testing.T, dir, run, version string, counts map[string]int) string {
	t.Helper()

	t.Setenv("GROUNDWORK_SESSION", "s-seal")

	if _, err := journal.WriteBattery(dir, journal.Battery{
		RunID:      run,
		Version:    version,
		Counts:     counts,
		DurationMS: 1,
	}); err != nil {
		t.Fatalf("could not record a battery run: %v", err)
	}

	return run
}

// grant is the fixture every test here starts from: a repo with two covered
// files, a green battery run behind it, and a design seal over both.
func grant(t *testing.T, dir string, paths ...string) Granted {
	t.Helper()

	greenRun(t, dir)

	got, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: paths})
	if err != nil {
		t.Fatalf("granting a seal failed: %v", err)
	}

	return got
}

func TestGrantWritesTheTagTheMirrorAndTheJournalLine(t *testing.T) {
	dir := newRepo(t)
	one := commitFile(t, dir, "docs/one.md", "one\n")
	two := commitFile(t, dir, "docs/two.md", "two\n")

	got := grant(t, dir, "docs/two.md", "docs/one.md")

	if got.Tag != "seal/design/b3s3" {
		t.Fatalf("the seal landed at %q, want seal/design/b3s3", got.Tag)
	}
	if got.Target != runGit(t, dir, "rev-parse", "HEAD") {
		t.Errorf("the seal names the commit %s, and HEAD is %s",
			got.Target, runGit(t, dir, "rev-parse", "HEAD"))
	}

	// The blob hashes are read from git, never from the caller: a seal that
	// took the hash on trust would name whatever it was handed.
	want := []Covered{{Blob: one, Path: "docs/one.md"}, {Blob: two, Path: "docs/two.md"}}
	if len(got.Covered) != 2 || got.Covered[0] != want[0] || got.Covered[1] != want[1] {
		t.Errorf("the seal covers %v, want %v", got.Covered, want)
	}

	// The tag is annotated, and its message is the one the contract fixes.
	if kind := runGit(t, dir, "cat-file", "-t", "refs/tags/"+got.Tag); kind != "tag" {
		t.Errorf("the seal tag is a %s, and a seal is an annotated tag", kind)
	}
	message := gitRaw(t, dir, "tag", "-l", "--format=%(contents)", got.Tag)
	if _, err := ParseMessage(message); err != nil {
		t.Errorf("the tag this granted does not parse as a seal message: %v", err)
	}

	// The mirror holds the tag's own bytes, because the host refuses to push
	// a tag ref at all (R5).
	raw := gitRaw(t, dir, "cat-file", "tag", got.Tag)
	stored := gitRaw(t, dir, "cat-file", "blob", Branch+":tags/"+got.Tag)
	if stored != raw {
		t.Errorf("the mirror holds %d bytes and the tag is %d bytes", len(stored), len(raw))
	}

	oid := runGit(t, dir, "rev-parse", "refs/tags/"+got.Tag)
	index := gitRaw(t, dir, "cat-file", "blob", Branch+":"+IndexFile)
	if !strings.Contains(index, oid+" "+got.Tag+"\n") {
		t.Errorf("the mirror index is %q, and it does not name %s at %s", index, got.Tag, oid)
	}
}

// D28 named this slice's obligation: the seal line's battery and battery_run
// fields are D23's second recording place, and they land with the machinery.
func TestGrantJournalsTheBatteryItWasGrantedUnder(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")

	got := grant(t, dir, "docs/one.md")

	lines, err := journal.Seals(dir)
	if err != nil {
		t.Fatalf("reading the seal lines failed: %v", err)
	}
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d seal lines, want 1", len(lines))
	}

	line := lines[0]
	if line.Tag != got.Tag || line.Kind != "design" || line.Action != "granted" {
		t.Errorf("the seal line is %+v, want a granted design seal on %s", line, got.Tag)
	}
	if line.Target != got.Target {
		t.Errorf("the seal line names the commit %s, and the tag names %s", line.Target, got.Target)
	}
	if line.Battery != got.Battery || line.BatteryRun != got.BatteryRun {
		t.Errorf("the seal line carries %q and %q, and the tag carries %q and %q",
			line.Battery, line.BatteryRun, got.Battery, got.BatteryRun)
	}
	if line.Battery != "8.0+r1234567" || line.BatteryRun != "run-20260826T120000Z-abcd" {
		t.Errorf("the seal line carries %q and %q, which is not the run it was granted on",
			line.Battery, line.BatteryRun)
	}
}

// The battery pair is read from the journal's own newest battery line, not from
// the caller. A grant that took the version on trust would let an agent seal
// work under a version that never ran.
func TestGrantRefusesWithoutAGreenBatteryRun(t *testing.T) {
	t.Run("no battery run at all", func(t *testing.T) {
		dir := newRepo(t)
		commitFile(t, dir, "docs/one.md", "one\n")
		t.Setenv("GROUNDWORK_SESSION", "s-seal")

		_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
		if err == nil {
			t.Fatal("a seal was granted with no battery run behind it")
		}
		if !strings.Contains(err.Error(), "holds no battery run") {
			t.Errorf("the error is %q, and it does not say what was missing", err)
		}
	})

	t.Run("the newest run was red", func(t *testing.T) {
		dir := newRepo(t)
		commitFile(t, dir, "docs/one.md", "one\n")
		recordRun(t, dir, "run-20260826T120000Z-abcd", "8.0+r1234567",
			map[string]int{"green": 9, "red": 1, "waived": 0, "quarantined": 0, "unrunnable": 0})

		_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
		if err == nil {
			t.Fatal("a seal was granted on a red run")
		}
		if !strings.Contains(err.Error(), "red") {
			t.Errorf("the error is %q, and it does not say the run was red", err)
		}
	})
}

func TestGrantRefusesWhatItCannotSeal(t *testing.T) {
	cases := []struct {
		name  string
		grant Grant
		says  string
	}{
		{"no path at all", Grant{Kind: "design", Subject: "b3s3"}, "path"},
		{
			"a path git does not hold at HEAD",
			Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/nowhere.md"}},
			"docs/nowhere.md",
		},
		{
			"a directory rather than a file",
			Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs"}},
			"docs",
		},
		{
			"a path outside the charset",
			Grant{Kind: "design", Subject: "b3s3", Paths: []string{"../secrets"}},
			"path",
		},
		{
			"the same path twice",
			Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md", "docs/one.md"}},
			"twice",
		},
		{
			"a kind nobody declared",
			Grant{Kind: "review", Subject: "b3s3", Paths: []string{"docs/one.md"}},
			"review",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			commitFile(t, dir, "docs/one.md", "one\n")
			greenRun(t, dir)

			if _, err := GrantSeal(dir, c.grant); err == nil {
				t.Fatalf("%s was sealed", c.name)
			} else if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error is %q, and it does not say %q", err, c.says)
			}
		})
	}
}

// A seal that already exists is moved through amend, which prints the before
// and the after and demands a reason. Granting over it would move a seal with
// no record of what it used to cover.
func TestGrantRefusesToOverwriteASeal(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	grant(t, dir, "docs/one.md")

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
	if err == nil {
		t.Fatal("a second grant overwrote the first")
	}
	if !strings.Contains(err.Error(), "amend") {
		t.Errorf("the error is %q, and it does not point at the verb that moves a seal", err)
	}
}

// R4: the CLI never holds or creates a signing key. So every seal it grants is
// unsigned, and the grant says so rather than leaving the caller to assume.
func TestAGrantedSealIsUnsigned(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")

	got := grant(t, dir, "docs/one.md")
	if got.Signature != Unsigned {
		t.Fatalf("a granted seal reports the signature state %q, want %q", got.Signature, Unsigned)
	}

	raw := gitRaw(t, dir, "cat-file", "tag", got.Tag)
	if strings.Contains(raw, "SIGNATURE") {
		t.Errorf("the tag this granted carries a signature block:\n%s", raw)
	}
}

// F64: the page says a covered path opens with a letter, a digit or a dot, and
// the parser allowed a leading underscore. The page is the rule; the code
// tightens to it (D52.7). The reviewer granted _leading.md through the built
// binary, so the grant is where this is proved.
func TestGrantRefusesAPathThatOpensWithAnUnderscore(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "_leading.md", "leading\n")
	greenRun(t, dir)

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"_leading.md"}})
	if err == nil {
		t.Fatal("a path opening with an underscore was sealed")
	}
	if !strings.Contains(err.Error(), "_leading.md") {
		t.Errorf("the error is %q, and it does not name the path", err)
	}
}

// The message a person reads when their path is refused names the path, says
// what the first character may be, and says what the rest may be — in that
// order, once each, with no double negative in it. F66: it ran long enough, and
// backwards enough, to need a second reading.
//
// The path is measured at one character, so what is capped here is the fixed
// half of the sentence rather than somebody's long path.
func TestThePathRefusalIsReadOnce(t *testing.T) {
	err := checkPath("_")
	if err == nil {
		t.Fatal("a path opening with an underscore passed")
	}

	got := err.Error()
	if len(got) > 150 {
		t.Errorf("the refusal is %d bytes, and it is meant to be read once: %s", len(got), got)
	}
	if !strings.Contains(got, `"_"`) {
		t.Errorf("the refusal is %q, and it does not name the path", got)
	}

	// The order is the order a person reads: which character opens it, then
	// which characters the rest may be.
	opens := strings.Index(got, "open with a letter, a digit or a dot")
	rest := strings.Index(got, "letters, digits, dots, dashes, underscores and slashes")
	if opens < 0 || rest < 0 {
		t.Fatalf("the refusal is %q, and it does not state both halves of the rule", got)
	}
	if opens > rest {
		t.Errorf("the refusal is %q, and it states the rest before the first character", got)
	}
	if strings.Contains(got, "none of") {
		t.Errorf("the refusal is %q, and it says the rule as a double negative", got)
	}
}

// F66 and D52.9: a run with every count at zero checked nothing, and D17 says a
// verifier may never pass on nothing. A seal granted on it would stand on a run
// that proved nothing at all.
func TestGrantRefusesARunThatCheckedNothing(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	recordRun(t, dir, "run-20260826T120000Z-abcd", "8.0+r1234567",
		map[string]int{"green": 0, "red": 0, "waived": 0, "quarantined": 0, "unrunnable": 0})

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
	if err == nil {
		t.Fatal("a seal was granted on a run that checked nothing")
	}
	if !strings.Contains(err.Error(), "checked nothing") {
		t.Errorf("the error is %q, and it does not say the run checked nothing", err)
	}
}

// D52.2 covers every step after the tag, not just the mirror. A journal that
// will not take the line leaves the same standing wreck a mirror failure would.
//
// The journal ref is made unwritable the way git itself makes one unwritable:
// a lock file stands over it, which is what another writer holding it looks
// like from the outside.
func TestAGrantThatCannotJournalRemovesItsOwnTag(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	greenRun(t, dir)

	lock := filepath.Join(dir, ".git", filepath.FromSlash(journal.Ref)+".lock")
	if err := os.WriteFile(lock, nil, 0o600); err != nil {
		t.Fatalf("could not put a lock over the journal ref: %v", err)
	}

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
	if err == nil {
		t.Fatal("a grant that could not journal reported success")
	}
	if !strings.Contains(err.Error(), "journal") {
		t.Errorf("the error is %q, and it does not say the journal is what failed", err)
	}

	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/seal/design/b3s3"); err == nil {
		t.Fatal("the half-made seal is still standing, and it verifies green")
	}
}

// F67: the rollback undid one of the two writes. A journal failure took the tag
// down and left the mirror blob, so the grant said "no seal was granted" while
// the next restore in any clone produced the seal and verify called it sound.
// The wreck had moved from the tag to the branch.
//
// This is the re-check's own probe: a session id the journal will not accept,
// so the write fails after the tag and the mirror are both in place.
func TestAGrantThatCannotJournalLeavesNoMirrorBlobEither(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	greenRun(t, dir)

	t.Setenv("GROUNDWORK_SESSION", "not a session id")

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "demo", Paths: []string{"docs/one.md"}})
	if err == nil {
		t.Fatal("a grant with a session id the journal refuses reported success")
	}

	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/seal/design/demo"); err == nil {
		t.Error("the tag is still standing")
	}

	// The branch itself must be gone: this grant was the only thing that ever
	// wrote to it.
	if tip, err := resolve(dir, mirrorRef); err != nil || tip != "" {
		t.Fatalf("the mirror branch is at %q, and nothing was ever meant to land on it", tip)
	}

	// And the whole point: a clone restoring from this mirror must produce
	// nothing at all.
	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if res.HasMirror || len(res.Tags) != 0 {
		t.Fatalf("restore reports %+v, and the grant said no seal was granted", res)
	}
}

// The other half: a mirror that already holds seals is put back where it was,
// not wiped. The old value is passed to update-ref, so a writer that moved the
// branch in between is never clobbered.
func TestARolledBackGrantPutsTheMirrorBackWhereItWas(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")
	first := grant(t, dir, "docs/one.md")

	was, err := resolve(dir, mirrorRef)
	if err != nil || was == "" {
		t.Fatalf("the first grant left no mirror: %v", err)
	}

	t.Setenv("GROUNDWORK_SESSION", "not a session id")

	if _, err := GrantSeal(dir, Grant{
		Kind: "design", Subject: "second", Paths: []string{"docs/two.md"},
	}); err == nil {
		t.Fatal("the second grant reported success")
	}

	now, err := resolve(dir, mirrorRef)
	if err != nil {
		t.Fatalf("could not read the mirror: %v", err)
	}
	if now != was {
		t.Fatalf("the mirror is at %s, and it was at %s before the grant that failed", now, was)
	}

	// The seal that was already there is untouched.
	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Tag != first.Tag {
		t.Fatalf("restore reports %+v, want only the first seal", res.Tags)
	}
}

// The old value is what makes a rollback safe. A branch another writer moved
// between this grant's mirror write and its rollback is theirs, not this
// grant's to put back — so update-ref is handed the value this grant wrote, and
// refuses when the branch no longer holds it.
//
// The race is not raced here. The rollback is asked directly, with a mirrorNow
// the branch has since left, which is what a writer moving in between leaves
// behind. Every value in it is a real object, so the only thing that can refuse
// the write is the old-value check itself.
func TestARollbackWillNotMoveAMirrorSomebodyElseMoved(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")
	grant(t, dir, "docs/one.md")

	theirs, err := resolve(dir, mirrorRef)
	if err != nil || theirs == "" {
		t.Fatalf("the grant left no mirror: %v", err)
	}

	// A tag of its own, so the tag half of the rollback succeeds and only the
	// mirror half is under test.
	head := runGit(t, dir, "rev-parse", "HEAD")
	runGit(t, dir, "update-ref", "refs/tags/seal/design/second", head)

	// A rollback that believes it wrote a tip the branch has since left. Both
	// values name real commits.
	undo := grantUndo{
		tag:       "seal/design/second",
		tagOID:    head,
		mirrorWas: head,
		mirrorNow: runGit(t, dir, "rev-parse", "HEAD~1"),
	}

	err = undo.run(dir, errors.New("the journal did not take it"))
	if err == nil {
		t.Fatal("a rollback against a branch it does not hold reported success")
	}
	if !strings.Contains(err.Error(), "did not finish") {
		t.Errorf("the error is %q, and it does not say the rollback did not finish", err)
	}

	if now, _ := resolve(dir, mirrorRef); now != theirs {
		t.Fatalf("the rollback moved the mirror to %s, and somebody else had it at %s", now, theirs)
	}
}

// The tag half of the same guarantee. A tag another writer re-pointed between
// this grant's write and its rollback is theirs, so the delete is handed the
// object id this grant wrote, and refuses when the tag no longer holds it.
func TestARollbackWillNotTakeDownATagSomebodyElseMoved(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")

	// The other writer's tag stands at HEAD. This rollback believes it wrote
	// the tag at HEAD~1, so the old-value check is the only thing under test.
	head := runGit(t, dir, "rev-parse", "HEAD")
	runGit(t, dir, "update-ref", "refs/tags/seal/design/second", head)

	undo := grantUndo{
		tag:    "seal/design/second",
		tagOID: runGit(t, dir, "rev-parse", "HEAD~1"),
	}

	err := undo.run(dir, errors.New("the journal did not take it"))
	if err == nil {
		t.Fatal("a rollback against a tag it does not hold reported success")
	}
	if !strings.Contains(err.Error(), "did not finish") {
		t.Errorf("the error is %q, and it does not say the rollback did not finish", err)
	}

	if now := runGit(t, dir, "rev-parse", "refs/tags/seal/design/second"); now != head {
		t.Fatalf("the rollback moved the tag to %s, and somebody else had it at %s", now, head)
	}
}
