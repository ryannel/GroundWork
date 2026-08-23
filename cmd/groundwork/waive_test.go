package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/ryannel/groundwork/internal/battery"
)

// day returns the UTC date n days from now, in the format the waive verb takes.
func day(n int) string {
	return time.Now().UTC().AddDate(0, 0, n).Format("2006-01-02")
}

// waiveArgs is a full set of arguments for the waive verb.
func waiveArgs(extra ...string) []string {
	args := []string{"waive", "honesty", "--reason", "the scan cannot see the table helper", "--expires", day(5)}

	return append(args, extra...)
}

func TestWaiveWritesTheFileAndSaysWhatToDoWithIt(t *testing.T) {
	dir := newRepo(t)

	code, out, errOut := call(t, waiveArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	path := strings.Fields(out)[0]
	if !strings.HasPrefix(path, battery.WaiverDir+"/") {
		t.Fatalf("stdout starts %q, want the path of the new waiver", path)
	}
	if _, err := os.Stat(filepath.Join(dir, path)); err != nil {
		t.Fatalf("the waiver is not on disk: %v", err)
	}

	// The verb never commits, so the human has to. Saying so is the only thing
	// standing between a waiver and a feature diff it would not survive.
	if !strings.Contains(out, "own commit") {
		t.Errorf("stdout is %q, and it does not tell the reader to commit the waiver on its own", out)
	}
}

func TestWaiveJournalsTheGrant(t *testing.T) {
	dir := newRepo(t)

	code, _, errOut := call(t, waiveArgs()...)
	if code != 0 {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	lines := batteryLines(t, dir, "waiver")
	if len(lines) != 1 {
		t.Fatalf("the journal holds %d waiver lines, want 1", len(lines))
	}
	if lines[0]["action"] != "granted" {
		t.Errorf("the line's action is %v, want granted", lines[0]["action"])
	}
	if lines[0]["row"] != "honesty" {
		t.Errorf("the line's row is %v, want honesty", lines[0]["row"])
	}
}

func TestWaiveWithAWrongCommandLine(t *testing.T) {
	cases := []struct {
		name string
		args []string
		code int
		says string
	}{
		{"no row at all", []string{"waive", "--reason", "r", "--expires", day(5)}, exitUsage, "row"},
		{"two rows", append(waiveArgs(), "wiring"), exitUsage, "wiring"},
		{"no reason", []string{"waive", "honesty", "--expires", day(5)}, exitUsage, "--reason"},
		{"no expiry", []string{"waive", "honesty", "--reason", "r"}, exitUsage, "--expires"},
		{"a row the battery does not hold", []string{
			"waive", "honestly", "--reason", "r", "--expires", day(5),
		}, exitFailed, "honestly"},
		{"an expiry too far out", []string{
			"waive", "honesty", "--reason", "r", "--expires", day(31),
		}, exitFailed, "30 days"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := newRepo(t)

			code, _, errOut := call(t, c.args...)
			if code != c.code {
				t.Fatalf("exit code is %d, want %d. stderr: %s", code, c.code, errOut)
			}
			if !strings.Contains(errOut, c.says) {
				t.Errorf("stderr is %q, and it does not hold %q", errOut, c.says)
			}

			if entries, _ := os.ReadDir(filepath.Join(dir, battery.WaiverDir)); len(entries) != 0 {
				t.Errorf("a refused waive left %d files behind", len(entries))
			}
		})
	}
}

func TestWaiveOutsideARepo(t *testing.T) {
	t.Chdir(t.TempDir())

	code, _, errOut := call(t, waiveArgs()...)
	if code != exitFailed {
		t.Fatalf("exit code is %d, want %d", code, exitFailed)
	}
	if !strings.Contains(errOut, "not in a git repository") {
		t.Errorf("stderr is %q, want it to say the directory is not a repository", errOut)
	}
}

// The verbs a reader can run are the verbs the usage names.
func TestUsageNamesTheNewVerbs(t *testing.T) {
	code, _, errOut := call(t)
	if code != exitUsage {
		t.Fatalf("exit code is %d, want %d", code, exitUsage)
	}

	for _, verb := range []string{"waive", "drove"} {
		if !strings.Contains(errOut, verb) {
			t.Errorf("the usage does not name the verb %q: %s", verb, errOut)
		}
	}
}

// L1: the path the verb prints is the one the person can act on from where
// they are standing. A repo-root-relative path copied out of a subdirectory
// names a file that is not there.
func TestWaiveFromASubdirectoryPrintsAPathThatWorksThere(t *testing.T) {
	dir := newRepo(t)

	deep := filepath.Join(dir, "pkg", "deep")
	if err := os.MkdirAll(deep, 0o750); err != nil {
		t.Fatalf("could not make the subdirectory: %v", err)
	}
	t.Chdir(deep)

	code, out, errOut := call(t, waiveArgs()...)
	if code != exitOK {
		t.Fatalf("exit code is %d, want 0. stderr: %s", code, errOut)
	}

	path := strings.Fields(out)[0]
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("the printed path %q does not name a file from here: %v", path, err)
	}
}

// L2: a usage error says one true thing. The old shape reported the spare
// argument and then two flags as missing, because the parser had stopped
// before it read them.
func TestWaiveSaysOneTrueThingAboutASpareArgument(t *testing.T) {
	newRepo(t)

	code, _, errOut := call(t, "waive", "honesty", "wiring", "--reason", "r", "--expires", day(5))
	if code != exitUsage {
		t.Fatalf("exit code is %d, want %d", code, exitUsage)
	}
	if !strings.Contains(errOut, "wiring") {
		t.Errorf("stderr is %q, and it does not name the spare argument", errOut)
	}
	for _, untrue := range []string{"--reason needs a value", "--expires needs a value"} {
		if strings.Contains(errOut, untrue) {
			t.Errorf("stderr says %q, which is not true: the flags were given", untrue)
		}
	}
}
