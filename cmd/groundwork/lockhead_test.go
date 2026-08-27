package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/battery"
)

// R15 through the front door: the version a person is told is the committed
// one, and a working tree that says something else is said rather than passed
// over.

func TestVerifyVersionFailsOnAnUncommittedBump(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())

	// Bumped in the working tree and committed nowhere, which is the state a
	// slice's own build sits in until it lands.
	path := filepath.Join(dir, battery.LockFile)
	if err := os.WriteFile(path, []byte("{\"version\":\"9.9\",\"digest\":\""+trueDigest()+"\"}\n"), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}

	code, out, errOut := call(t, "verify", "version")
	if code != exitFailed {
		t.Fatalf("verify version exited %d over an uncommitted bump: %s%s", code, out, errOut)
	}
	for _, want := range []string{"0.1", "9.9", battery.LockFile} {
		if !strings.Contains(errOut, want) {
			t.Errorf("the error does not carry %q: %s", want, errOut)
		}
	}
	if strings.Contains(out, "9.9") {
		t.Errorf("verify version printed the uncommitted version: %s", out)
	}
}

// The run itself goes red on the same state, through the version row, and the
// run still records itself: an uncommitted bump is a fault the journal holds
// like any other.
func TestVerifyGoesRedOnAnUncommittedBump(t *testing.T) {
	dir := newRepo(t)
	writeLock(t, dir, "0.1", trueDigest())

	path := filepath.Join(dir, battery.LockFile)
	if err := os.WriteFile(path, []byte("{\"version\":\"9.9\",\"digest\":\""+trueDigest()+"\"}\n"), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}

	code, out, errOut := call(t, "verify")
	if code != exitFailed {
		t.Fatalf("verify exited %d over an uncommitted bump: %s%s", code, out, errOut)
	}
	if !strings.Contains(out, "red") || !strings.Contains(out, battery.LockFile) {
		t.Errorf("the run does not show the version row red over the lock file: %s", out)
	}
	// The label is the committed version, not the one nobody committed.
	if !strings.Contains(out, "battery 0.1+") {
		t.Errorf("the run did not label itself with the committed version: %s", out)
	}
}
