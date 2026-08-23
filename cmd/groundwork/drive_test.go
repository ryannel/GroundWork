package main

import (
	"strings"
	"testing"
)

func TestDroveRecordsTheDrive(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	head := runGit(t, dir, "rev-parse", "HEAD")

	code, out, errOut := call(t, "drove", "--notes", "ran the CLI end to end and read the journal back")
	if code != exitOK {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	path := strings.TrimSpace(out)
	if path == "" {
		t.Fatal("the verb printed nothing, so nobody can find the line it wrote")
	}

	event := eventAt(t, dir, path)
	if event["kind"] != "drive" {
		t.Errorf("the line's kind is %v, want drive", event["kind"])
	}
	if event["notes"] != "ran the CLI end to end and read the journal back" {
		t.Errorf("the line's notes are %v", event["notes"])
	}

	// The commit and the session are what the seal machinery reads: a drive is
	// evidence only if the record says when it happened and who did it.
	if event["commit"] != head {
		t.Errorf("the line's commit is %v, want %q", event["commit"], head)
	}
	if event["session"] != "s-alpha" {
		t.Errorf("the line's session is %v, want s-alpha", event["session"])
	}
}

func TestDroveWithAWrongCommandLine(t *testing.T) {
	cases := []struct {
		name string
		args []string
		says string
	}{
		{"no notes", []string{"drove"}, "--notes"},
		{"empty notes", []string{"drove", "--notes", ""}, "--notes"},
		{"a spare argument", []string{"drove", "--notes", "drove it", "twice"}, "twice"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			code, _, errOut := call(t, c.args...)
			if code != exitUsage {
				t.Fatalf("exit code is %d, want %d. stderr: %s", code, exitUsage, errOut)
			}
			if !strings.Contains(errOut, c.says) {
				t.Errorf("stderr is %q, and it does not hold %q", errOut, c.says)
			}
			if refExists(t, dir) {
				t.Error("a refused drive still wrote to the journal")
			}
		})
	}
}

func TestDroveOutsideARepo(t *testing.T) {
	t.Chdir(t.TempDir())

	code, _, errOut := call(t, "drove", "--notes", "drove it")
	if code != exitFailed {
		t.Fatalf("exit code is %d, want %d", code, exitFailed)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say the directory is not a repository", errOut)
	}
}
