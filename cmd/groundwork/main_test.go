package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// newRepo makes a git repo with one commit in a temp dir, and moves the test
// into it. The CLI works on the current directory, like git does.
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

	path := filepath.Join(dir, "README.md")
	if err := os.WriteFile(path, []byte("start\n"), 0o600); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
	runGit(t, dir, "add", "README.md")
	runGit(t, dir, "commit", "-m", "first")

	t.Chdir(dir)

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

// call runs the CLI and returns its exit code, stdout and stderr.
func call(t *testing.T, args ...string) (int, string, string) {
	t.Helper()

	var out, errOut bytes.Buffer
	code := run(args, &out, &errOut)

	return code, out.String(), errOut.String()
}

// dispatchArgs is a full set of valid flags for journal dispatch.
func dispatchArgs(extra ...string) []string {
	args := []string{
		"journal", "dispatch",
		"--role", "worker",
		"--tier", "execution",
		"--tokens-in", "120",
		"--tokens-out", "45",
		"--duration-ms", "9100",
		"--outcome", "ok",
	}

	return append(args, extra...)
}

func TestRunRejectsBadUsage(t *testing.T) {
	cases := []struct {
		name string
		args []string
	}{
		{"no arguments", nil},
		{"unknown verb", []string{"jounral"}},
		{"journal with no subcommand", []string{"journal"}},
		{"unknown journal subcommand", []string{"journal", "dispatched"}},
		{"unknown flag", dispatchArgs("--colour", "blue")},
		{"missing role", []string{"journal", "dispatch", "--tier", "execution", "--outcome", "ok"}},
		{"missing outcome", []string{
			"journal", "dispatch",
			"--role", "worker", "--tier", "execution",
			"--tokens-in", "1", "--tokens-out", "1", "--duration-ms", "1",
		}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			newRepo(t)
			t.Setenv("GROUNDWORK_SESSION", "s-alpha")

			code, out, errOut := call(t, c.args...)
			if code != 2 {
				t.Errorf("exit code is %d, want 2", code)
			}
			if errOut == "" {
				t.Errorf("bad usage should say something on stderr")
			}
			if out != "" {
				t.Errorf("bad usage should print nothing on stdout, got %q", out)
			}
		})
	}
}

func TestRunRejectsAValueOutsideTheVocabulary(t *testing.T) {
	newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	args := dispatchArgs()
	args[3] = "supervisor"

	code, out, errOut := call(t, args...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if errOut == "" {
		t.Errorf("a failed write should say something on stderr")
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunWritesADispatch(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	path := strings.TrimSpace(out)
	if !strings.HasPrefix(path, "events/s-alpha/") {
		t.Fatalf("the CLI printed %q, want a path under events/s-alpha/", path)
	}

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+path)

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the written event is not valid JSON: %v", err)
	}

	want := map[string]any{
		"kind":          "dispatch",
		"role":          "worker",
		"tier":          "execution",
		"tokens_source": "unset",
		"outcome":       "ok",
	}
	for field, value := range want {
		if event[field] != value {
			t.Errorf("field %q is %v, want %v", field, event[field], value)
		}
	}
	if event["duration_ms"] != float64(9100) {
		t.Errorf("field \"duration_ms\" is %v, want 9100", event["duration_ms"])
	}
}

func TestRunTakesATokensSource(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs("--tokens-source", "estimated")...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+strings.TrimSpace(out))

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the written event is not valid JSON: %v", err)
	}
	if event["tokens_source"] != "estimated" {
		t.Errorf("field \"tokens_source\" is %v, want \"estimated\"", event["tokens_source"])
	}
}

func TestRunSaysWhenItIsNotInARepo(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs()...)
	if code != 1 {
		t.Errorf("exit code is %d, want 1", code)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say it is not in a git repository", errOut)
	}
	if strings.Contains(errOut, "rev-parse") {
		t.Errorf("stderr is %q, want plain words rather than git's own output", errOut)
	}
	if out != "" {
		t.Errorf("a failed write should print nothing on stdout, got %q", out)
	}
}

func TestRunDefaultsTheTokensSourceToUnset(t *testing.T) {
	dir := newRepo(t)
	t.Setenv("GROUNDWORK_SESSION", "s-alpha")

	code, out, errOut := call(t, dispatchArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	raw := runGit(t, dir, "cat-file", "blob", "refs/groundwork/journal:"+strings.TrimSpace(out))

	var event map[string]any
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("the written event is not valid JSON: %v", err)
	}
	if event["tokens_source"] != "unset" {
		t.Errorf("field \"tokens_source\" is %v, want \"unset\"", event["tokens_source"])
	}
}
