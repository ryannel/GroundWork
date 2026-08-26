package seal

import (
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// amendment is the fixture: a seal granted, then moved onto a second path with
// a reason.
func amendment(t *testing.T, dir string, paths ...string) Amended {
	t.Helper()

	got, err := AmendSeal(dir, Amendment{
		Kind:    "design",
		Subject: "b3s3",
		Paths:   paths,
		Reason:  "the design docs were split in two",
	})
	if err != nil {
		t.Fatalf("amending the seal failed: %v", err)
	}

	return got
}

// R6: amend prints the before and the after. It returns both, so the verb can
// print them and a test can read them.
func TestAmendMovesTheTagAndSaysWhatChanged(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	two := commitFile(t, dir, "docs/two.md", "two\n")
	was := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag)

	got := amendment(t, dir, "docs/one.md", "docs/two.md")

	if got.Tag != granted.Tag {
		t.Fatalf("the amendment landed on %q, want %q", got.Tag, granted.Tag)
	}
	if len(got.Before.Covered) != 1 || got.Before.Covered[0].Path != "docs/one.md" {
		t.Errorf("the before covers %v, want docs/one.md alone", got.Before.Covered)
	}
	if len(got.After.Covered) != 2 {
		t.Fatalf("the after covers %v, want two paths", got.After.Covered)
	}
	if got.After.Covered[1] != (Covered{Blob: two, Path: "docs/two.md"}) {
		t.Errorf("the after covers %v, and the second path is not docs/two.md at its blob",
			got.After.Covered)
	}
	if got.Reason != "the design docs were split in two" {
		t.Errorf("the amendment records the reason %q", got.Reason)
	}

	now := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag)
	if now == was {
		t.Fatal("the tag did not move")
	}

	// The tag that stands now is the after, and it reads as a seal.
	message := gitRaw(t, dir, "tag", "-l", "--format=%(contents)", granted.Tag)
	m, err := ParseMessage(message)
	if err != nil {
		t.Fatalf("the amended tag does not parse as a seal message: %v", err)
	}
	if len(m.Covered) != 2 {
		t.Errorf("the amended tag covers %v, want two paths", m.Covered)
	}
}

// R6: amend refuses without a reason. A seal moved with no reason on the record
// is a seal that moved for no reason anybody can read.
func TestAmendRefusesWithoutAReason(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	grant(t, dir, "docs/one.md")

	_, err := AmendSeal(dir, Amendment{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
	if err == nil {
		t.Fatal("a seal was amended with no reason")
	}
	if !strings.Contains(err.Error(), "reason") {
		t.Errorf("the error is %q, and it does not say a reason is needed", err)
	}
}

// Amending a seal nobody granted would be a grant wearing the wrong verb, with
// a before that does not exist.
func TestAmendRefusesASealThatIsNotThere(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	greenRun(t, dir)

	_, err := AmendSeal(dir, Amendment{
		Kind: "design", Subject: "b3s3",
		Paths:  []string{"docs/one.md"},
		Reason: "there was nothing to amend",
	})
	if err == nil {
		t.Fatal("a seal that was never granted was amended")
	}
	if !strings.Contains(err.Error(), "grant") {
		t.Errorf("the error is %q, and it does not point at the verb that makes a seal", err)
	}
}

// R6: amend records the prior target in the mirror. The tag that was there is
// the only evidence of what was sealed before, and moving the ref would
// otherwise leave nothing behind.
func TestAmendRecordsThePriorTagInTheMirror(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	was := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag)
	raw := gitRaw(t, dir, "cat-file", "tag", granted.Tag)

	commitFile(t, dir, "docs/two.md", "two\n")
	amendment(t, dir, "docs/one.md", "docs/two.md")

	kept := gitRaw(t, dir, "cat-file", "blob", Branch+":"+PriorDir+granted.Tag+"/"+was)
	if kept != raw {
		t.Fatalf("the mirror kept %d bytes of the prior tag, and it was %d bytes", len(kept), len(raw))
	}

	// The mirror's current copy is the amended tag, not the old one.
	now := gitRaw(t, dir, "cat-file", "blob", Branch+":"+TagDir+granted.Tag)
	if now == raw {
		t.Error("the mirror still holds the tag that was replaced as the current one")
	}
}

// D13: until a move kind exists, a move is two lines — revoked, then granted.
// The revoked line names the commit the tag held, and the granted line names
// the one it holds now, so neither line states something the tag never said.
func TestAmendWritesRevokedThenGranted(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	was := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag+"^{commit}")

	commitFile(t, dir, "docs/two.md", "two\n")
	got := amendment(t, dir, "docs/one.md", "docs/two.md")

	lines, err := journal.Seals(dir)
	if err != nil {
		t.Fatalf("reading the seal lines failed: %v", err)
	}
	if len(lines) != 3 {
		t.Fatalf("the journal holds %d seal lines, want the grant and the two the amendment writes", len(lines))
	}

	revoked, granted2 := lines[1], lines[2]
	if revoked.Action != "revoked" || granted2.Action != "granted" {
		t.Fatalf("the amendment wrote %q then %q, want revoked then granted",
			revoked.Action, granted2.Action)
	}
	if revoked.Target != was {
		t.Errorf("the revoked line names %s, and the tag held %s", revoked.Target, was)
	}
	if granted2.Target != got.After.Target {
		t.Errorf("the granted line names %s, and the tag holds %s", granted2.Target, got.After.Target)
	}
	for _, line := range []journal.SealLine{revoked, granted2} {
		if line.Battery == "" || line.BatteryRun == "" {
			t.Errorf("the %s line carries no battery pair", line.Action)
		}
		// R6 refuses an amendment without a reason, and a reason that is only
		// printed is not on the record.
		if line.Reason != "the design docs were split in two" {
			t.Errorf("the %s line records the reason %q", line.Action, line.Reason)
		}
	}
	if lines[0].Reason != "" {
		t.Errorf("the grant records the reason %q, and a grant gives none", lines[0].Reason)
	}
}

// R6's half that machinery cannot enforce: an agent typing a reason is not the
// owner speaking. So the record states who signed the amended tag, and an
// unsigned amendment reads as agent-recorded, never owner-approved.
func TestAnUnsignedAmendmentReadsAsAgentRecorded(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	grant(t, dir, "docs/one.md")

	commitFile(t, dir, "docs/two.md", "two\n")
	got := amendment(t, dir, "docs/one.md", "docs/two.md")

	if got.Signature != Unsigned {
		t.Fatalf("the amended tag reports %q, and this tool holds no signing key", got.Signature)
	}
	if got.Signer != "" {
		t.Errorf("the amendment names %q as the signer", got.Signer)
	}
	if !strings.Contains(got.Note, "agent") {
		t.Errorf("the note is %q, and it does not say an agent recorded this", got.Note)
	}
	if strings.Contains(strings.ToLower(got.Note), "approved") {
		t.Errorf("the note is %q, and an unsigned amendment is not an approval", got.Note)
	}
}

// F65 and D52.8: R6 says the record states who signed. Printing it and letting
// it go is exactly what D51.3 forbade for the reason, so the amendment's own
// journal lines carry the signature state too.
func TestAmendRecordsTheSignatureOnItsJournalLines(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	grant(t, dir, "docs/one.md")

	commitFile(t, dir, "docs/two.md", "two\n")
	amendment(t, dir, "docs/one.md", "docs/two.md")

	lines, err := journal.Seals(dir)
	if err != nil {
		t.Fatalf("reading the seal lines failed: %v", err)
	}
	if len(lines) != 3 {
		t.Fatalf("the journal holds %d seal lines, want 3", len(lines))
	}

	if lines[0].Signature != "unsigned" {
		t.Errorf("the grant recorded the signature state %q", lines[0].Signature)
	}
	if lines[2].Signature != "unsigned" {
		t.Errorf("the amendment's granted line recorded the signature state %q", lines[2].Signature)
	}
	for _, line := range lines {
		if line.Signer != "" {
			t.Errorf("a %s line names %q as the signer, and nothing here signed", line.Action, line.Signer)
		}
	}
}

// F69: the writer-strict mirror guard ran in the grant and not in the
// amendment, against its own comment. An amendment writes to the mirror the
// same way, so it stops the same way.
func TestAmendRefusesToWriteOntoAJunkedMirror(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")
	granted := grant(t, dir, "docs/one.md")

	plantOnMirror(t, dir, map[string]string{TagDir + "evil": "not a tag object\n"})
	was := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag)

	_, err := AmendSeal(dir, Amendment{
		Kind: "design", Subject: "b3s3",
		Paths:  []string{"docs/one.md", "docs/two.md"},
		Reason: "the design docs were split in two",
	})
	if err == nil {
		t.Fatal("an amendment onto a mirror holding a junk file reported success")
	}
	if !strings.Contains(err.Error(), "evil") {
		t.Errorf("the error is %q, and it does not name the file to go and look at", err)
	}
	if now := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag); now != was {
		t.Fatalf("the tag moved to %s, and the amendment was refused", now)
	}
}
