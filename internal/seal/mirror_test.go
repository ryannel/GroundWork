package seal

import (
	"strings"
	"testing"
)

// TestProof_b3s3_restore_rebuilds_a_tag_byte_for_byte is R5's whole point.
//
// The host's git proxy refuses pushes outside refs/heads, so a seal tag cannot
// travel as a tag. It travels as a blob on a branch, and comes back through
// git hash-object -t tag -w. A tag object's id is the hash of its own bytes, so
// getting the same id back is proof that every byte survived — the tagger line,
// the message, and the signature block.
//
// The tag here is signed for real. F62 corrected F57: this host's git config
// carries gpg.format=ssh and a signing shim, so git tag -s produces a genuine
// SSH signature block. It cannot be verified here, and it does not need to be:
// what is proved is that the bytes come back.
func TestProof_b3s3_restore_rebuilds_a_tag_byte_for_byte(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")

	const tag = "seal/design/b3s3"
	signTag(t, dir, tag, sealMessageFor(t, dir, "b3s3"))

	was := runGit(t, dir, "rev-parse", "refs/tags/"+tag)
	raw := gitRaw(t, dir, "cat-file", "tag", tag)
	if !strings.Contains(raw, "BEGIN SSH SIGNATURE") {
		t.Fatalf("the fixture tag carries no signature block:\n%s", raw)
	}

	if err := mirror(dir, tag); err != nil {
		t.Fatalf("mirroring the tag failed: %v", err)
	}

	runGit(t, dir, "update-ref", "-d", "refs/tags/"+tag)
	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/"+tag); err == nil {
		t.Fatal("the tag is still there, so the restore proves nothing")
	}

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if !res.HasMirror {
		t.Fatal("restore found no mirror on a repo that has one")
	}
	if len(res.Tags) != 1 || res.Tags[0].Tag != tag || res.Tags[0].Status != RestoreDone {
		t.Fatalf("restore reports %+v, want %s restored", res.Tags, tag)
	}

	now := runGit(t, dir, "rev-parse", "refs/tags/"+tag)
	if now != was {
		t.Fatalf("the restored tag is %s, and it was %s", now, was)
	}
	if back := gitRaw(t, dir, "cat-file", "tag", tag); back != raw {
		t.Fatalf("the restored tag reads:\n%s\nand it was:\n%s", back, raw)
	}
	if !strings.Contains(gitRaw(t, dir, "cat-file", "tag", tag), "BEGIN SSH SIGNATURE") {
		t.Error("the signature block did not survive the round trip")
	}
}

// A tag already standing at the same object is left alone, and the report says
// so rather than claiming a restore that did nothing.
func TestRestoreLeavesATagThatIsAlreadyThere(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Status != RestoreAlready {
		t.Fatalf("restore reports %+v, want %s already there", res.Tags, granted.Tag)
	}
}

// A name already taken by a different object is never overwritten. The mirror
// is a mirror, and a restore that clobbered a local tag would make it the
// record instead.
func TestRestoreRefusesToClobberADifferentTag(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	was := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag)

	runGit(t, dir, "update-ref", "-d", "refs/tags/"+granted.Tag)
	plantTag(t, dir, granted.Tag, "seal: design b3s3\n", "")
	planted := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag)

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Status != RestoreMismatch {
		t.Fatalf("restore reports %+v, want a mismatch on %s", res.Tags, granted.Tag)
	}
	if now := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag); now != planted {
		t.Fatalf("restore moved the tag to %s, and it must leave %s alone", now, planted)
	}
	if was == planted {
		t.Fatal("the fixture planted the same object, so nothing was proved")
	}
}

// A repo with no mirror branch has nothing to restore, and says so. It is not
// an error: most clones have never granted a seal.
func TestRestoreOnARepoWithNoMirror(t *testing.T) {
	dir := newRepo(t)

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if res.HasMirror || len(res.Tags) != 0 {
		t.Fatalf("restore reports %+v on a repo with no mirror", res)
	}
}

// The mirror is written on a branch of its own, and it never touches the
// working tree or the branch the work is on.
func TestMirroringLeavesTheWorkingTreeAlone(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	writeFile(t, dir+"/scratch.txt", "not committed\n")

	head := runGit(t, dir, "rev-parse", "HEAD")
	branch := runGit(t, dir, "symbolic-ref", "--short", "HEAD")

	grant(t, dir, "docs/one.md")

	if now := runGit(t, dir, "rev-parse", "HEAD"); now != head {
		t.Errorf("HEAD moved from %s to %s", head, now)
	}
	if now := runGit(t, dir, "symbolic-ref", "--short", "HEAD"); now != branch {
		t.Errorf("the branch moved from %s to %s", branch, now)
	}
	if status := runGit(t, dir, "status", "--porcelain"); status != "?? scratch.txt" {
		t.Errorf("the working tree reads %q, want the one untracked file it started with", status)
	}
}

// A name a different object already stands at is left alone. The mirror is a
// mirror: a restore that clobbered a local tag would make the branch the record
// instead.
func TestRestoreLeavesADifferentObjectWhereItIs(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	runGit(t, dir, "update-ref", "-d", "refs/tags/"+granted.Tag)
	planted := plantTag(t, dir, granted.Tag, "seal: design b3s3\n", "")

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Status != RestoreMismatch {
		t.Fatalf("restore reports %+v, want a mismatch", res.Tags)
	}
	if now := runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag); now != planted {
		t.Fatalf("restore moved the tag to %s, and %s was already standing there", now, planted)
	}
	if res.Tags[0].Why == "" {
		t.Error("the mismatch says nothing about why it did not restore")
	}
}

// plantMirror puts files on the mirror branch through plumbing, which is how a
// hostile mirror is made: the writing path here refuses to build one.
func plantMirror(t *testing.T, dir string, add map[string]string) {
	t.Helper()

	tree, err := inTempIndex(dir, func(env []string) error {
		return putAll(dir, env, add)
	})
	if err != nil {
		t.Fatalf("could not build the planted tree: %v", err)
	}

	commit, err := gitEnv(dir, identity(), nil, "commit-tree", tree, "-m", "planted")
	if err != nil {
		t.Fatalf("could not commit the planted tree: %v", err)
	}

	if _, err := gitOut(dir, nil, "update-ref", mirrorRef, strings.TrimSpace(commit)); err != nil {
		t.Fatalf("could not point the mirror at the planted commit: %v", err)
	}
}

// F59 and D52.1: one scribbled file on a pushable branch must never stop the
// other tags. The walker skips it and reports it, the way the index reader
// already does for the same class.
func TestRestoreReportsAJunkFileAndRestoresTheRest(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	plantOnMirror(t, dir, map[string]string{TagDir + "evil": "not a tag object\n"})
	runGit(t, dir, "update-ref", "-d", "refs/tags/"+granted.Tag)

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("one junk file stopped the whole restore: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Tag != granted.Tag || res.Tags[0].Status != RestoreDone {
		t.Fatalf("restore reports %+v, want %s restored", res.Tags, granted.Tag)
	}
	if len(res.Ignored) != 1 || !strings.Contains(res.Ignored[0].Path, "evil") {
		t.Fatalf("restore ignored %+v, and it must report the junk file", res.Ignored)
	}
	if res.Ignored[0].Why == "" {
		t.Error("the ignored file is reported with no reason")
	}
	if runGit(t, dir, "rev-parse", "refs/tags/"+granted.Tag) == "" {
		t.Error("the good tag did not come back")
	}
}

// F63: a tag rebuilt under a file name its own bytes do not declare is a lie
// the restore reports as a success, and verify then has to catch. The bytes
// carry the name; the file name has to agree with it before any ref is written.
func TestRestoreRefusesATagWhoseBytesNameADifferentTag(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	raw := gitRaw(t, dir, "cat-file", "tag", granted.Tag)
	plantOnMirror(t, dir, map[string]string{TagDir + "seal/design/elsewhere": raw})

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}

	for _, one := range res.Tags {
		if one.Tag != "seal/design/elsewhere" {
			continue
		}
		if one.Status == RestoreDone {
			t.Fatalf("a tag whose bytes name %s was restored as %s", granted.Tag, one.Tag)
		}
		if !strings.Contains(one.Why, granted.Tag) {
			t.Errorf("the refusal is %q, and it does not name what the bytes say", one.Why)
		}
	}
	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/seal/design/elsewhere"); err == nil {
		t.Error("the lying name was written as a ref")
	}
}

// F63: the missing-index guard could never fire, because cat-file exits 128
// where the check wanted 1. A mirror holding tags and no index is an ordinary
// state — nothing writes the index by hand — and it must restore.
func TestRestoreOnAMirrorWithNoIndex(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	raw := gitRaw(t, dir, "cat-file", "tag", granted.Tag)
	runGit(t, dir, "update-ref", "-d", "refs/tags/"+granted.Tag)

	// A mirror holding the tag and nothing else.
	plantMirror(t, dir, map[string]string{TagDir + granted.Tag: raw})

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("a mirror with no index stopped the restore: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Status != RestoreDone {
		t.Fatalf("restore reports %+v, want the tag restored", res.Tags)
	}
}

// F63: D51.6's index half had no test at all. The index says which object the
// mirror's bytes are meant to be, and bytes that hash to something else are the
// shape of a mirror somebody edited.
func TestRestoreReportsBytesThatDoNotMatchTheIndex(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	granted := grant(t, dir, "docs/one.md")

	runGit(t, dir, "update-ref", "-d", "refs/tags/"+granted.Tag)
	plantOnMirror(t, dir, map[string]string{
		IndexFile: strings.Repeat("0", 40) + " " + granted.Tag + "\n",
	})

	res, err := Restore(dir)
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if len(res.Tags) != 1 || res.Tags[0].Status != RestoreMismatch {
		t.Fatalf("restore reports %+v, want a mismatch against the index", res.Tags)
	}
	if !strings.Contains(res.Tags[0].Why, "index") {
		t.Errorf("the mismatch says %q, and it does not name the index", res.Tags[0].Why)
	}
	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/"+granted.Tag); err == nil {
		t.Error("a tag whose bytes disagree with the index was written")
	}
}

// D52.2: a grant that cannot mirror removes its own tag and fails whole. A seal
// that exists only where it was made is a standing wreck that verifies green.
//
// The mirror is made unwritable the way git itself makes a ref unwritable: a
// ref one level down takes the name.
func TestAGrantThatCannotMirrorRemovesItsOwnTag(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	greenRun(t, dir)

	runGit(t, dir, "update-ref", mirrorRef+"/blocked", runGit(t, dir, "rev-parse", "HEAD"))

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "b3s3", Paths: []string{"docs/one.md"}})
	if err == nil {
		t.Fatal("a grant that could not mirror reported success")
	}
	if !strings.Contains(err.Error(), "mirror") {
		t.Errorf("the error is %q, and it does not say the mirror is what failed", err)
	}

	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/seal/design/b3s3"); err == nil {
		t.Fatal("the half-made seal is still standing, and it verifies green")
	}

	rep, err := Verify(dir)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if rep.Seals != 0 {
		t.Fatalf("verify found %d seals after a grant that failed", rep.Seals)
	}
}

// The writer is strict where the reader is permissive. Restore has to rehydrate
// what is there, junk beside it or not. A grant is new work, and new work onto
// a branch somebody has scribbled on stops until a person looks — and it stops
// before the tag is made, so there is no tag to leave behind.
func TestGrantRefusesToWriteOntoAJunkedMirror(t *testing.T) {
	dir := newRepo(t)
	commitFile(t, dir, "docs/one.md", "one\n")
	commitFile(t, dir, "docs/two.md", "two\n")
	grant(t, dir, "docs/one.md")

	plantOnMirror(t, dir, map[string]string{TagDir + "evil": "not a tag object\n"})

	_, err := GrantSeal(dir, Grant{Kind: "design", Subject: "second", Paths: []string{"docs/two.md"}})
	if err == nil {
		t.Fatal("a grant onto a mirror holding a junk file reported success")
	}
	if !strings.Contains(err.Error(), "evil") {
		t.Errorf("the error is %q, and it does not name the file to go and look at", err)
	}

	if _, err := tryGit(dir, "rev-parse", "--verify", "--quiet", "refs/tags/seal/design/second"); err == nil {
		t.Fatal("the grant left a tag behind")
	}
}

// plantOnMirror adds files to what the mirror already holds.
func plantOnMirror(t *testing.T, dir string, add map[string]string) {
	t.Helper()

	tip, err := resolve(dir, mirrorRef)
	if err != nil || tip == "" {
		t.Fatalf("this repo has no mirror to plant on: %v", err)
	}

	tree, err := inTempIndex(dir, func(env []string) error {
		if _, err := gitEnv(dir, env, nil, "read-tree", tip); err != nil {
			return err
		}

		return putAll(dir, env, add)
	})
	if err != nil {
		t.Fatalf("could not build the planted tree: %v", err)
	}

	commit, err := gitEnv(dir, identity(), nil, "commit-tree", tree, "-p", tip, "-m", "planted")
	if err != nil {
		t.Fatalf("could not commit the planted tree: %v", err)
	}

	if _, err := gitOut(dir, nil, "update-ref", mirrorRef, strings.TrimSpace(commit)); err != nil {
		t.Fatalf("could not point the mirror at the planted commit: %v", err)
	}
}

// SubjectOf is TagName's inverse, and it reads only a name TagName could have
// made. A caller that took the subject off any other ref name would be reading a
// second rule about what a seal tag is called, and the two would drift the first
// time a kind or a charset moved.
func TestSubjectOfReadsASealTagAndRefusesEverythingElse(t *testing.T) {
	for _, kind := range Kinds() {
		tag, err := TagName(kind, "b3_design")
		if err != nil {
			t.Fatalf("the tag name for %s did not build: %v", kind, err)
		}

		got, ok := SubjectOf(tag)
		if !ok || got != "b3_design" {
			t.Errorf("SubjectOf(%q) is %q, %v; want b3_design, true", tag, got, ok)
		}
	}

	for _, bad := range []string{
		"",
		"v1.0",
		"refs/heads/main",
		"seal/design",
		"seal/design/",
		"seal/nope/b3_design",
		"seal/design/Not-An-Id",
		"seal/design/b3_design/extra",
	} {
		if got, ok := SubjectOf(bad); ok {
			t.Errorf("SubjectOf(%q) read the subject %q, and that name is not a seal tag's", bad, got)
		}
	}
}
