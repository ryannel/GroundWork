package seal

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode"

	"github.com/ryannel/groundwork/internal/journal"
)

// plantTag writes one annotated tag object by hand and points a ref at it.
//
// It goes through git plumbing rather than git tag, because a tag carrying a
// signature block cannot be made here any other way, and because a hostile tag
// is exactly what this row has to survive.
func plantTag(t *testing.T, dir, tag, message, signature string) string {
	t.Helper()

	commit := runGit(t, dir, "rev-parse", "HEAD")
	raw := fmt.Sprintf("object %s\ntype commit\ntag %s\ntagger Test Person <test@example.com> 1755000000 +0000\n\n%s%s",
		commit, tag, message, signature)

	oid := gitStdin(t, dir, raw, "hash-object", "-t", "tag", "-w", "--stdin")
	runGit(t, dir, "update-ref", "refs/tags/"+tag, oid)

	return oid
}

func TestVerifyHoldsWhenNothingMoved(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")
	got := grant(t, dir, "docs/one.md", "docs/two.md")

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}

	if rep.Seals != 1 || rep.Paths != 2 || rep.Moved != 0 || rep.Problems != 0 {
		t.Fatalf("verify reports %+v, want one sound seal over two paths", rep)
	}
	if len(rep.Results) != 1 || rep.Results[0].Tag != got.Tag {
		t.Fatalf("verify reports %d results, want one for %s", len(rep.Results), got.Tag)
	}
	for _, p := range rep.Results[0].Covered {
		if p.State != Held {
			t.Errorf("%s reads as %s, and nothing has changed", p.Path, p.State)
		}
	}
}

// R3: seal verify recomputes each covered path's blob hash at HEAD and names
// every path that moved.
func TestVerifyNamesEveryPathThatMoved(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")
	grant(t, dir, "docs/one.md", "docs/two.md")

	commitFile(t, dir, "docs/one.md", "one, edited\n")

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}

	if rep.Moved != 1 || rep.Problems != 1 {
		t.Fatalf("verify reports %+v, want one moved path", rep)
	}

	res := rep.Results[0]
	if res.Sound() {
		t.Error("a seal whose covered path moved reads as sound")
	}

	moved := res.MovedPaths()
	if len(moved) != 1 || moved[0].Path != "docs/one.md" {
		t.Fatalf("verify named %v as moved, want docs/one.md", moved)
	}
	if moved[0].State != Moved {
		t.Errorf("docs/one.md reads as %s, want %s", moved[0].State, Moved)
	}
	if moved[0].Sealed == moved[0].Now || moved[0].Now == "" {
		t.Errorf("the path reads sealed %q and now %q", moved[0].Sealed, moved[0].Now)
	}
	if !strings.Contains(res.Problems[0], "docs/one.md") {
		t.Errorf("the first problem is %q, and it does not name the path", res.Problems[0])
	}
	// The path that did not move must not be dragged in with it.
	for _, p := range res.Covered {
		if p.Path == "docs/two.md" && p.State != Held {
			t.Errorf("docs/two.md reads as %s, and it was not touched", p.State)
		}
	}
}

// A covered path that is gone at HEAD is not "unchanged because there is
// nothing to compare". It is the loudest kind of moved.
func TestVerifyNamesACoveredPathThatIsGone(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	grant(t, dir, "docs/one.md")

	runGit(t, dir, "rm", "--", "docs/one.md")
	runGit(t, dir, "commit", "-m", "drop it")

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if rep.Moved != 1 {
		t.Fatalf("verify reports %+v, want the gone path counted", rep)
	}

	moved := rep.Results[0].MovedPaths()
	if len(moved) != 1 || moved[0].State != Gone {
		t.Fatalf("verify reports %v, want docs/one.md gone", moved)
	}
	if moved[0].Now != "" {
		t.Errorf("a path that is gone reports the hash %q at HEAD", moved[0].Now)
	}
}

// TestProof_b3s3_unsigned_never_reads_as_human_authority proves R4's half that
// machinery can enforce: only a good signature by a listed key is authority,
// and nothing else in this tool may read as one.
//
// Every state that is not verified is walked, and each is pinned to the branch
// that produced it — F63 caught this proof exercising only the branch this repo
// never takes. The states:
//
//   - the seal the tool granted, which carries no signature at all, because the
//     tool holds no key;
//   - a real signed tag in a repo that commits a signers file, which is what
//     this repo is: the signature is genuine and nothing here can check it;
//   - a real signed tag in a repo that commits none.
//
// The tags are signed for real. F62 corrected F57: this host's git config
// carries gpg.format=ssh and a signing shim, so git tag -s makes a genuine
// signature block. What it cannot do is verify one.
//
// There is a fourth state, missing, and it has its own test: missing is red,
// and these three are loud.
func TestProof_b3s3_unsigned_never_reads_as_human_authority(t *testing.T) {
	cases := []struct {
		name    string
		signers bool
		sign    bool
		want    Signature
		says    string
	}{
		{
			name: "the seal the tool granted", signers: true, sign: false,
			want: Unsigned, says: "no signature",
		},
		{
			name: "a real signature in a repo that commits a signers file", signers: true, sign: true,
			want: Unverified, says: "no verifier ran",
		},
		{
			name: "a real signature in a repo that commits none", signers: false, sign: true,
			want: Unverified, says: "HEAD holds no",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			commitFile(t, dir, "docs/one.md", "one\n")
			if c.signers {
				committedSigners(t, dir, "# committed, and empty of keys\n")
			}

			tag := "seal/design/b3s3"
			if c.sign {
				tag = "seal/design/signed"
				greenRun(t, dir)
				signTag(t, dir, tag, sealMessageFor(t, dir, "signed"))
			} else {
				grant(t, dir, "docs/one.md")
			}

			res, err := VerifyTag(dir, tag)
			if err != nil {
				t.Fatalf("verifying %s failed: %v", tag, err)
			}

			if res.Authority() {
				t.Fatalf("%s reads as human authority", c.name)
			}
			if res.Signature == Verified {
				t.Fatalf("%s reads as verified", c.name)
			}
			if res.Signature != c.want {
				t.Errorf("%s reads as %q, want %q", c.name, res.Signature, c.want)
			}
			// The note pins which branch ran, so this proof cannot drift onto a
			// branch nobody here takes without saying so.
			if !strings.Contains(res.SignatureNote, c.says) {
				t.Errorf("the note is %q, and it does not say %q", res.SignatureNote, c.says)
			}
			// Loud, not blocking: this bet has no key outside the agents'
			// reach, so a seal nobody signed is printed and never fails a run.
			if !res.Sound() {
				t.Errorf("%s is not sound, and unsigned is loud but not blocking in this bet", c.name)
			}
		})
	}
}

// A seal that was asked for and is not there is missing, and missing is red.
// It is the one signature state that fails, because a seal nobody can find
// proves nothing at all.
func TestVerifyTagSaysWhenASealIsMissing(t *testing.T) {
	dir := newRepo(t)

	_, err := VerifyTag(dir, "seal/design/b3s3")
	if !errors.Is(err, ErrNoSeal) {
		t.Fatalf("verifying a seal that is not there gave %v, want ErrNoSeal", err)
	}
	if !strings.Contains(err.Error(), "seal/design/b3s3") {
		t.Errorf("the error is %q, and it does not name the seal", err)
	}
}

// A repo that holds no seal tag states no seal, so it can misstate none. This
// is the plan row's shape, and the report says only that.
func TestVerifyOnARepoWithNoSeals(t *testing.T) {
	dir := newRepo(t)

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if rep.Seals != 0 || len(rep.Results) != 0 || rep.Problems != 0 {
		t.Fatalf("verify reports %+v on a repo with no seal, want nothing", rep)
	}
}

// A tag that names itself a seal and carries something else is a problem, not
// a seal to be skipped. Skipping it would let anyone silence a seal by
// scribbling on it.
func TestVerifyReadsABadTagAsAProblem(t *testing.T) {
	cases := []struct {
		name string
		make func(t *testing.T, dir string)
		says string
	}{
		{
			"a message that is not a seal message",
			func(t *testing.T, dir string) {
				plantTag(t, dir, "seal/design/junk", "hello\n", "")
			},
			"seal:",
		},
		{
			"a lightweight tag",
			func(t *testing.T, dir string) {
				runGit(t, dir, "tag", "seal/design/light")
			},
			"annotated",
		},
		{
			"a tag whose name does not match its message",
			func(t *testing.T, dir string) {
				plantTag(t, dir, "seal/design/elsewhere",
					"seal: design b3s3\n\ncovers:\n  "+strings.Repeat("1", 40)+
						" docs/one.md\n\nBattery: 8.0+r1234567\nBattery-Run: run-20260826T120000Z-abcd\n", "")
			},
			"name",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			commitFile(t, dir, "docs/one.md", "one\n")
			c.make(t, dir)

			rep, err := Verify(dir)
			if err != nil {
				t.Fatalf("verify failed: %v", err)
			}
			if rep.Problems == 0 {
				t.Fatalf("%s reads as sound: %+v", c.name, rep)
			}
			if !strings.Contains(rep.FirstProblem(), c.says) {
				t.Errorf("the first problem is %q, and it does not say %q", rep.FirstProblem(), c.says)
			}
		})
	}
}

// D23 asked a later bet to check that the two recording places agree. This is
// that check: the tag's trailers against the journal seal line's fields.
func TestVerifyChecksTheTagTrailersAgainstTheSealLine(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	message := gitRaw(t, dir, "tag", "-l", "--format=%(contents)", granted.Tag)
	moved := strings.Replace(message, "Battery: 8.0+r1234567", "Battery: 9.0+r7654321", 1)

	runGit(t, dir, "update-ref", "-d", "refs/tags/"+granted.Tag)
	plantTag(t, dir, granted.Tag, moved, "")

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if rep.Problems == 0 {
		t.Fatalf("a tag whose battery trailer was rewritten reads as sound: %+v", rep)
	}
	if !strings.Contains(rep.FirstProblem(), "9.0+r7654321") ||
		!strings.Contains(rep.FirstProblem(), "8.0+r1234567") {
		t.Errorf("the problem is %q, and it does not show both halves of the disagreement",
			rep.FirstProblem())
	}
}

// A seal restored into a fresh clone has no journal line behind it, because the
// journal is a different ref and may not have travelled. That is not a fault:
// the report says the cross-check did not run, and never claims it passed.
func TestVerifySaysWhenNoSealLineBacksTheTag(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	runGit(t, dir, "update-ref", "-d", journal.Ref)

	res, err := VerifyTag(dir, granted.Tag)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if !res.Sound() {
		t.Fatalf("a seal with no journal line behind it reads as a problem: %v", res.Problems)
	}
	if res.JournalBattery != "" {
		t.Errorf("the result claims the seal line carries %q", res.JournalBattery)
	}
	if !strings.Contains(res.BatteryNote, "no seal line") {
		t.Errorf("the note is %q, and it does not say the cross-check had nothing to read",
			res.BatteryNote)
	}
}

// signTag makes a real SSH-signed annotated tag.
//
// F62: this host can sign. Its git config carries gpg.format=ssh and a signing
// shim, so git tag -s produces a genuine signature block. It cannot verify one
// — the shim only signs, and its public key file is empty — so a tag made here
// reads as unverified, which is the state these tests need.
func signTag(t *testing.T, dir, tag, message string) {
	t.Helper()

	if _, err := gitEnv(dir, identity(), []byte(message),
		"tag", "-s", "--cleanup=verbatim", "-F", "-", tag); err != nil {
		t.Fatalf("could not sign the tag %s: %v", tag, err)
	}
}

// committedSigners writes and commits an allowed-signers file.
func committedSigners(t *testing.T, dir, content string) {
	t.Helper()

	writeFile(t, filepath.Join(dir, filepath.FromSlash(AllowedSignersFile)), content)
	runGit(t, dir, "add", "--", AllowedSignersFile)
	runGit(t, dir, "commit", "-m", "add the signers file")
}

// F65 and D52.8: R4 says the signers file is committed, and a file an agent can
// swap on disk without a commit is not committed. So verification reads it from
// HEAD.
//
// Here HEAD holds none and the disk holds one. The result must be the answer
// for a repo with no committed signers file.
func TestVerificationReadsTheSignersFileFromHead(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	grant(t, dir, "docs/one.md")

	// On disk and in the index, and never committed. Staging it is what makes
	// this tell HEAD from the index: a read of the index would find the planted
	// file and pass, which is F69's small — the proof could not tell the two
	// apart until the file was staged.
	writeFile(t, filepath.Join(dir, filepath.FromSlash(AllowedSignersFile)), "# planted\n")
	runGit(t, dir, "add", "--", AllowedSignersFile)

	signTag(t, dir, "seal/design/signed", sealMessageFor(t, dir, "signed"))

	res, err := VerifyTag(dir, "seal/design/signed")
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if res.Signature != Unverified {
		t.Fatalf("a signed tag reads as %q, want %q", res.Signature, Unverified)
	}
	if !strings.Contains(res.SignatureNote, "HEAD holds no") {
		t.Errorf("the note is %q, and HEAD holds no signers file", res.SignatureNote)
	}
}

// And the other way: HEAD holds one, the disk does not. Swapping the file on
// disk changes nothing, which is the whole point of reading HEAD.
func TestASignersFileSwappedOnDiskChangesNothing(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	committedSigners(t, dir, "# committed, and empty of keys\n")
	grant(t, dir, "docs/one.md")

	signTag(t, dir, "seal/design/signed", sealMessageFor(t, dir, "signed"))

	before, err := VerifyTag(dir, "seal/design/signed")
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}

	// Swap it on disk for something else, then take it away entirely.
	writeFile(t, filepath.Join(dir, filepath.FromSlash(AllowedSignersFile)), "# swapped\n")
	after, err := VerifyTag(dir, "seal/design/signed")
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if after.Signature != before.Signature || after.SignatureNote != before.SignatureNote {
		t.Errorf("swapping the file on disk changed %q/%q into %q/%q",
			before.Signature, before.SignatureNote, after.Signature, after.SignatureNote)
	}

	if err := os.Remove(filepath.Join(dir, filepath.FromSlash(AllowedSignersFile))); err != nil {
		t.Fatalf("could not take the file away: %v", err)
	}
	gone, err := VerifyTag(dir, "seal/design/signed")
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if gone.SignatureNote != before.SignatureNote {
		t.Errorf("taking the file off disk changed the note to %q", gone.SignatureNote)
	}
	if strings.Contains(gone.SignatureNote, "HEAD holds no") {
		t.Errorf("the note is %q, and HEAD holds the file", gone.SignatureNote)
	}
}

// sealMessageFor builds a valid seal message over docs/one.md for one subject.
func sealMessageFor(t *testing.T, dir, subject string) string {
	t.Helper()

	text, err := Message{
		Kind: "design", Subject: subject,
		Covered:    []Covered{{Blob: runGit(t, dir, "rev-parse", "HEAD:docs/one.md"), Path: "docs/one.md"}},
		Battery:    "8.0+r1234567",
		BatteryRun: "run-20260826T120000Z-abcd",
	}.Render()
	if err != nil {
		t.Fatalf("could not render a seal message: %v", err)
	}

	return text
}

// D52.5: the note says which of three situations the reader is in, read from
// what git actually said. One vague sentence for three situations is what F60
// caught, and the situation this repo is in — no verifier at all — is the one
// that read as a checked-and-bad answer.
func TestTheUnverifiedNoteSaysWhichSituation(t *testing.T) {
	cases := []struct {
		name string
		said string
		want string
	}{
		{
			"no verifier on this machine",
			"error: cannot run ssh-keygen: No such file or directory",
			"no verifier",
		},
		{
			"a shim that only signs",
			"Error: unsupported code-sign operation: currently only SSH-style signing (-Y sign) is supported",
			"no verifier",
		},
		{
			"a key nobody listed",
			"error: No principal matched.",
			"lists no key",
		},
		{
			"a bad signature",
			"error: Signature verification failed: incorrect signature",
			"does not check out",
		},
		{
			"something else entirely",
			"error: the sky fell in",
			"the sky fell in",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := whyNotVerified(c.said)
			if !strings.Contains(got, c.want) {
				t.Errorf("git said %q and the note is %q, which does not say %q", c.said, got, c.want)
			}
			for _, r := range got {
				if !unicode.IsPrint(r) {
					t.Errorf("the note %q holds the unprintable character %q", got, r)
				}
			}
		})
	}
}

// D52.5: the signer is parsed from git's SSH verify output too. The GPG status
// line this started with is one git's SSH path never produces, so on the
// owner's machine a verified amendment would have recorded an empty signer.
//
// The host limit: this container cannot run the verified branch at all — the
// signing shim only signs — so this is proved on git's own wording rather than
// on a live verification. F62 records where it first runs for real.
func TestSignerFromReadsBothOfGitsVerifyOutputs(t *testing.T) {
	cases := []struct {
		name string
		said string
		want string
	}{
		{
			"git's SSH wording",
			"Good \"git\" signature for owner@example.com with ED25519 key SHA256:abc\n",
			"owner@example.com",
		},
		{
			"git's SSH wording with no principal",
			"Good \"git\" signature with ED25519 key SHA256:abc\n",
			"",
		},
		{
			"git's GPG status line",
			"[GNUPG:] GOODSIG 1234ABCD Owner\n",
			"1234ABCD",
		},
		{
			"nothing git ever says",
			"who knows\n",
			"",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := signerFrom(c.said); got != c.want {
				t.Errorf("git said %q and the signer read as %q, want %q", c.said, got, c.want)
			}
		})
	}
}

// F60 and D52.3: a forged signature block printed as "1 unsigned", which is the
// exact blur D51.1 forbids. The two are counted apart, and the field that
// carried the blurred count is gone.
func TestVerifyCountsUnverifiedApartFromUnsigned(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	committedSigners(t, dir, "# committed, and empty of keys\n")
	grant(t, dir, "docs/one.md")
	signTag(t, dir, "seal/design/signed", sealMessageFor(t, dir, "signed"))

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}

	if rep.Seals != 2 {
		t.Fatalf("verify found %d seals, want 2", rep.Seals)
	}
	if rep.Unsigned != 1 {
		t.Errorf("verify counts %d unsigned, and one tag carries no signature", rep.Unsigned)
	}
	if rep.Unverified != 1 {
		t.Errorf("verify counts %d unverified, and one tag carries a signature nothing could check",
			rep.Unverified)
	}
	if rep.NoAuthority() != 2 {
		t.Errorf("verify counts %d with no authority, and neither seal is anybody's", rep.NoAuthority())
	}
}

// F66 and D52.9: an amendment writes revoked and then granted. One that dies
// between the two leaves revoked as the newest word on that tag, and the
// cross-check has to read it — an older grant must never out-answer a newer
// revocation.
func TestTheCrossCheckReadsTheNewestSealLineOfEitherAction(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	// The shape an amendment that died halfway leaves behind.
	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: "design", Tag: granted.Tag, Action: "revoked",
		Battery: "9.0+r7654321", BatteryRun: "run-20260827T120000Z-beef",
		Reason: "the amendment did not finish",
	}); err != nil {
		t.Fatalf("could not write the revoked line: %v", err)
	}

	res, err := VerifyTag(dir, granted.Tag)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if res.JournalBattery != "9.0+r7654321" {
		t.Fatalf("the cross-check read %q, and the newest line says 9.0+r7654321", res.JournalBattery)
	}
	if res.Sound() {
		t.Fatal("the tag agrees with a line that is no longer the newest one")
	}
}

// F68: reading the newest line of either action is only half the job. A revoked
// line carries the same battery pair the grant did, so a seal whose record says
// revoked compared equal and verified with zero problems — the state D52.9 set
// out to make visible was still invisible.
//
// This is the dying-amend shape: revoked written, and the granted line that was
// meant to follow it never arrived.
func TestASealWhoseNewestLineIsRevokedIsAProblem(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: "design", Tag: granted.Tag, Action: "revoked",
		Battery: granted.Battery, BatteryRun: granted.BatteryRun,
		Reason: "the amendment did not finish",
	}); err != nil {
		t.Fatalf("could not write the revoked line: %v", err)
	}

	res, err := VerifyTag(dir, granted.Tag)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if res.Sound() {
		t.Fatal("a seal the record says is revoked verified with no problem at all")
	}
	if !strings.Contains(res.Problems[0], "revoked") {
		t.Errorf("the problem is %q, and it does not say what the record says happened",
			res.Problems[0])
	}
	if !strings.Contains(res.Problems[0], granted.Tag) {
		t.Errorf("the problem is %q, and it does not name the seal", res.Problems[0])
	}
}
