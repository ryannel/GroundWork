package battery

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/journal"
)

// The lock file is project-authored input. It is committed by hand, so every
// shape a hand can produce has to fail plainly rather than be believed.

func TestReadLockAcceptsAHonestLockFile(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r3f9c1ab")

	lock, err := ReadLock(dir)
	if err != nil {
		t.Fatalf("a well-formed lock file was refused: %v", err)
	}
	if lock.Version != "0.1" || lock.Digest != "r3f9c1ab" {
		t.Fatalf("read %+v, want version 0.1 and digest r3f9c1ab", lock)
	}
}

// The lock file lives at the repo root, so a call from a subdirectory has to
// find the same file as a call from the top.
func TestReadLockFindsTheRootFromASubdirectory(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", "r3f9c1ab")

	deep := filepath.Join(dir, "internal", "battery")
	if err := os.MkdirAll(deep, 0o700); err != nil {
		t.Fatalf("could not make %s: %v", deep, err)
	}

	lock, err := ReadLock(deep)
	if err != nil {
		t.Fatalf("the lock file was not found from a subdirectory: %v", err)
	}
	if lock.Digest != "r3f9c1ab" {
		t.Fatalf("read %+v from a subdirectory", lock)
	}
}

func TestReadLockRefusesHostileShapes(t *testing.T) {
	cases := []struct {
		name    string
		content string
		says    string
	}{
		{"empty file", "", "not valid JSON"},
		{"malformed JSON", `{"version":"0.1",`, "not valid JSON"},
		{"a JSON array", `["0.1","r3f9c1ab"]`, "not valid JSON"},
		{"a JSON string", `"0.1+r3f9c1ab"`, "not valid JSON"},
		{"an unknown field", `{"version":"0.1","digest":"r3f9c1ab","digset":"r0000000"}`, "digset"},
		{"no version", `{"digest":"r3f9c1ab"}`, "version"},
		{"no digest", `{"version":"0.1"}`, "digest"},
		{"a digest with no r", `{"version":"0.1","digest":"3f9c1ab"}`, "digest"},
		{"a short digest", `{"version":"0.1","digest":"r3f9c1a"}`, "digest"},
		{"a long digest", `{"version":"0.1","digest":"r3f9c1abc"}`, "digest"},
		{"an uppercase digest", `{"version":"0.1","digest":"r3F9C1AB"}`, "digest"},
		{"a digest that is not hex", `{"version":"0.1","digest":"rzzzzzzz"}`, "digest"},
		{"a version with three parts", `{"version":"0.1.2","digest":"r3f9c1ab"}`, "version"},
		{"a version with one part", `{"version":"1","digest":"r3f9c1ab"}`, "version"},
		{"a version that is words", `{"version":"latest","digest":"r3f9c1ab"}`, "version"},
		{"a version with leading zeros", `{"version":"01.0","digest":"r3f9c1ab"}`, "version"},
		{"a negative version", `{"version":"-1.0","digest":"r3f9c1ab"}`, "version"},
		{"an absurdly long version", `{"version":"` + strings.Repeat("9", 10_000) + `.0","digest":"r3f9c1ab"}`, "version"},
		{"trailing words", `{"version":"0.1","digest":"r3f9c1ab"} TRAILING`, "more than one"},
		{"a second object", `{"version":"0.1","digest":"r3f9c1ab"}{"version":"9.9","digest":"r0000000"}`, "more than one"},
		{"a trailing array", `{"version":"0.1","digest":"r3f9c1ab"}[]`, "more than one"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)
			writeFile(t, filepath.Join(dir, LockFile), c.content)

			_, err := ReadLock(dir)
			if err == nil {
				t.Fatalf("%s was accepted", c.name)
			}
			if !strings.Contains(err.Error(), LockFile) {
				t.Errorf("the error does not name the lock file: %v", err)
			}
			if !strings.Contains(err.Error(), c.says) {
				t.Errorf("the error does not say %q: %v", c.says, err)
			}
		})
	}
}

// An absurdly long version must be refused on its length, before anything
// tries to print it back at the reader.
func TestReadLockRefusesALongVersionByItsLength(t *testing.T) {
	dir := newRepo(t)
	writeFile(t, filepath.Join(dir, LockFile),
		`{"version":"`+strings.Repeat("9", 10_000)+`.0","digest":"r3f9c1ab"}`)

	_, err := ReadLock(dir)
	if err == nil {
		t.Fatal("a 10,000 digit version was accepted")
	}
	if len(err.Error()) > 200 {
		t.Fatalf("the error is %d bytes long, so it printed the version back", len(err.Error()))
	}
}

// The error goes on a journal line as a row's evidence, and that line is
// capped. A deep repo path must not crowd the reason out of the message.
func TestReadLockErrorsStaySmallInADeepRepo(t *testing.T) {
	deep := filepath.Join(t.TempDir(), strings.Repeat("nested/", 20))
	if err := os.MkdirAll(deep, 0o700); err != nil {
		t.Fatalf("could not make %s: %v", deep, err)
	}
	for _, args := range [][]string{
		{"init", "-b", "main"},
		{"config", "user.name", "Test Person"},
		{"config", "user.email", "test@example.com"},
	} {
		runGit(t, deep, args...)
	}

	_, err := ReadLock(deep)
	if err == nil {
		t.Fatal("a missing lock file was accepted")
	}
	if len(err.Error()) > 120 {
		t.Fatalf("the error is %d bytes long: %v", len(err.Error()), err)
	}
	if !strings.Contains(err.Error(), "no such file") {
		t.Fatalf("the error does not say why it could not read the file: %v", err)
	}
}

func TestReadLockRefusesAMissingLockFile(t *testing.T) {
	dir := newRepo(t)

	_, err := ReadLock(dir)
	if err == nil {
		t.Fatal("a missing lock file was accepted")
	}
	if !strings.Contains(err.Error(), LockFile) {
		t.Fatalf("the error does not name the lock file: %v", err)
	}
}

func TestReadLockRefusesADirectory(t *testing.T) {
	dir := newRepo(t)
	if err := os.Mkdir(filepath.Join(dir, LockFile), 0o700); err != nil {
		t.Fatalf("could not make the directory: %v", err)
	}

	_, err := ReadLock(dir)
	if err == nil {
		t.Fatal("a lock file that is a directory was accepted")
	}
	if !strings.Contains(err.Error(), LockFile) {
		t.Fatalf("the error does not name the lock file: %v", err)
	}
}

// A lock file is not a lock file without a repo to be at the root of, and the
// caller says so in the same plain words every other verb uses.
func TestReadLockOutsideARepo(t *testing.T) {
	_, err := ReadLock(t.TempDir())
	if err == nil {
		t.Fatal("reading a lock file outside a git repository reported success")
	}
	if !errors.Is(err, journal.ErrNotARepo) {
		t.Fatalf("ReadLock returned %v, want ErrNotARepo", err)
	}
}

func TestLockPathOutsideARepo(t *testing.T) {
	_, err := LockPath(t.TempDir())
	if !errors.Is(err, journal.ErrNotARepo) {
		t.Fatalf("LockPath returned %v, want ErrNotARepo", err)
	}
}

func TestVersionStringPairsTheDeclaredHalfWithTheDigest(t *testing.T) {
	if got := VersionString("1.0", "r3f9c1ab"); got != "1.0+r3f9c1ab" {
		t.Fatalf("the version pair is %q, want 1.0+r3f9c1ab", got)
	}
}
