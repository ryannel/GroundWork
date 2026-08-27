package battery

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// R15: once the seal machinery exists, the battery lock file is read from the
// HEAD blob, the same read a covered path gets. These are that read.

// commitLock writes the lock file and commits it, which is what makes a
// declared version one anybody can be held to.
func commitLock(t *testing.T, dir, version, digest string) {
	t.Helper()

	writeLock(t, dir, version, digest)
	runGit(t, dir, "add", LockFile)
	runGit(t, dir, "commit", "-m", "declare the battery version")
}

// TestProof_b3s7_lock_the_version_is_read_from_the_head_blob is R15: an
// uncommitted battery version is not one anybody can be held to, so a
// working-tree-only bump reads as drift.
func TestProof_b3s7_lock_the_version_is_read_from_the_head_blob(t *testing.T) {
	reg := versionOnly()
	digest := reg.Digest()

	t.Run("the committed lock is the one the row judges", func(t *testing.T) {
		dir := newRepo(t)
		commitLock(t, dir, "1.0", digest)

		res := versionRow().Check(Context{RepoDir: dir, Digest: digest})
		if res.Outcome != Green {
			t.Fatalf("a committed lock that agrees came out %s: %s", res.Outcome, res.Evidence)
		}
		mustContain(t, res.Evidence, "1.0")
	})

	t.Run("a working-tree-only bump reads as drift", func(t *testing.T) {
		dir := newRepo(t)
		commitLock(t, dir, "1.0", digest)
		writeLock(t, dir, "2.0", digest)

		res := versionRow().Check(Context{RepoDir: dir, Digest: digest})
		if res.Outcome != Red {
			t.Fatalf("an uncommitted bump came out %s: %s", res.Outcome, res.Evidence)
		}
		mustContain(t, res.Evidence, LockFile, "2.0", "1.0")
	})

	t.Run("a lock nobody committed is no version at all", func(t *testing.T) {
		dir := newRepo(t)
		writeLock(t, dir, "1.0", digest)

		res := versionRow().Check(Context{RepoDir: dir, Digest: digest})
		if res.Outcome != Red {
			t.Fatalf("an uncommitted lock came out %s: %s", res.Outcome, res.Evidence)
		}
		mustContain(t, res.Evidence, LockFile)
	})

	t.Run("a committed lock the working tree no longer holds", func(t *testing.T) {
		dir := newRepo(t)
		commitLock(t, dir, "1.0", digest)
		if err := os.Remove(filepath.Join(dir, LockFile)); err != nil {
			t.Fatalf("could not remove the lock file: %v", err)
		}

		res := versionRow().Check(Context{RepoDir: dir, Digest: digest})
		if res.Outcome != Red {
			t.Fatalf("a deleted lock came out %s: %s", res.Outcome, res.Evidence)
		}
		mustContain(t, res.Evidence, LockFile)
	})
}

// The drift the row was built for still reds, read from HEAD: the committed
// lock declares a digest the rows do not compute.
func TestTheVersionRowStillRedsOnTheDriftItWasBuiltFor(t *testing.T) {
	dir := newRepo(t)
	commitLock(t, dir, "1.0", "r0000000")

	res := versionRow().Check(Context{RepoDir: dir, Digest: versionOnly().Digest()})
	if res.Outcome != Red {
		t.Fatalf("a drifted lock came out %s: %s", res.Outcome, res.Evidence)
	}
	mustContain(t, res.Evidence, "r0000000", versionOnly().Digest())
}

// The two reads are one parser. A lock file the working tree reader accepts and
// the HEAD reader refuses would be two rules about one file (D54 ruling 1).
func TestBothLockReadersRefuseTheSameShapes(t *testing.T) {
	cases := []struct {
		name    string
		content string
	}{
		{"not JSON", "{"},
		{"two objects", "{\"version\":\"1.0\",\"digest\":\"r0000000\"} {}"},
		{"an unknown field", "{\"version\":\"1.0\",\"digest\":\"r0000000\",\"extra\":1}"},
		{"a bad digest", "{\"version\":\"1.0\",\"digest\":\"nope\"}"},
		{"a bad version", "{\"version\":\"latest\",\"digest\":\"r0000000\"}"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeFile(t, filepath.Join(dir, LockFile), c.content)
			runGit(t, dir, "add", LockFile)
			runGit(t, dir, "commit", "-m", "a lock file nobody can read")

			tree, treeErr := ReadLock(dir)
			head, headErr := ReadLockAtHead(dir)

			if (treeErr == nil) != (headErr == nil) {
				t.Fatalf("the working tree reader said %v and the HEAD reader said %v", treeErr, headErr)
			}
			if treeErr == nil && tree != head {
				t.Fatalf("the two readers read %+v and %+v", tree, head)
			}
			if treeErr != nil && !strings.Contains(headErr.Error(), LockFile) {
				t.Errorf("the HEAD reader's error does not name the lock file: %v", headErr)
			}
		})
	}
}

// The run's own label is the committed version, for R15's reason: an
// uncommitted one is not a version anybody can be held to.
func TestTheRunsVersionLabelComesFromTheCommittedLock(t *testing.T) {
	dir := newRepo(t)
	reg := NewRegistry()
	reg.Register(fixed("one", "honesty", Blocking, Green))
	commitLock(t, dir, "1.0", reg.Digest())
	writeLock(t, dir, "9.9", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}
	if !strings.HasPrefix(res.Version, "1.0+") {
		t.Fatalf("the run labelled itself %q, want the committed 1.0", res.Version)
	}
}

// D64 ruling 6: the deletion test seeds its sample from the same lock every
// other reader reads. Seeding from the working tree made one run print two
// battery versions, and rotated the sample on a bump nobody had committed.
func TestTheMutateSeedComesFromTheCommittedLock(t *testing.T) {
	dir := newRepo(t)
	commitLock(t, dir, "1.0", "r0000000")
	writeLock(t, dir, "9.9", "r0000000")

	got := mutateVersion(Context{RepoDir: dir, Digest: "r0000000"})
	if !strings.HasPrefix(got, "1.0+") {
		t.Fatalf("the deletion test seeds from %q, want the committed 1.0", got)
	}
}

// And one run prints one version: the label the run carries and the version the
// deletion test seeds from are read from the same place.
func TestOneRunPrintsOneBatteryVersion(t *testing.T) {
	dir := newRepo(t)
	reg := NewRegistry()
	reg.Register(fixed("one", "honesty", Blocking, Green))
	commitLock(t, dir, "1.0", reg.Digest())
	writeLock(t, dir, "9.9", reg.Digest())

	res, err := Run(dir, reg)
	if err != nil {
		t.Fatalf("the run failed: %v", err)
	}

	seed := mutateVersion(Context{RepoDir: dir, Digest: res.Digest})
	if seed != res.Version {
		t.Fatalf("the run labels itself %q and the deletion test seeds from %q", res.Version, seed)
	}
}
