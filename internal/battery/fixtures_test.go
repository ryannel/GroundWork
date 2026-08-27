package battery

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// D64 ruling 9: every fixture repo maker turns commit signing off.
//
// The host signs commits by default, through a shim that dies under load with
// too many open files. A fixture that cannot commit becomes a proof that failed
// in the run, the board reads that as work regressing, and the flake machinery
// cannot fire because both attempts meet the same broken host (F100, F104).
//
// Blanking the rule fails no assertion. It makes the suite slow and flaky,
// which is what F100 was and what took a review round to find. So the rule is
// held to the shape of the makers themselves: a test file that inits a repo and
// never turns signing off is named here, in this repo's own source.
//
// Every file, not only the ones that commit. A repo made with no commit today
// grows one tomorrow, and the rule is cheaper to keep than to remember.
//
// And every maker in a file, counted. A file with two makers and one config
// call would pass a read that only asked whether the words appear.
func TestEveryFixtureRepoMakerTurnsSigningOff(t *testing.T) {
	const pinFile = "fixtures_test.go"

	root := filepath.Join("..", "..")

	var missing []string

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && (d.Name() == ".git" || d.Name() == "testdata") {
			return filepath.SkipDir
		}
		if d.IsDir() || !strings.HasSuffix(d.Name(), "_test.go") {
			return nil
		}
		// This file's own strings are test data for the counting rule, not repo
		// makers. Reading them would have the pin fail on itself.
		if d.Name() == pinFile {
			return nil
		}

		src, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		if !signingOff(string(src)) {
			inits, off := makersIn(string(src))
			missing = append(missing,
				fmt.Sprintf("%s: %d repos made, %d told not to sign", filepath.ToSlash(path), inits, off))
		}

		return nil
	})
	if err != nil {
		t.Fatalf("could not read this repo's own test sources: %v", err)
	}

	if len(missing) > 0 {
		t.Fatalf("these files make repos without turning signing off in each: %s",
			strings.Join(missing, "; "))
	}
}

// makersIn counts the repo makers one test source holds, and how many of them
// turn signing off.
//
// Counted, not merely present. A file with two makers and one config call, or a
// maker written with a different init spelling, would both pass a read that
// only asked whether the words appear (F115).
func makersIn(text string) (inits, off int) {
	return strings.Count(text, `"init"`), strings.Count(text, `"commit.gpgsign", "false"`)
}

// signingOff reports whether every maker one source holds turns signing off.
//
// Every maker, not one of them. A file with two makers and one config call
// would pass a read that asked only whether the words appear.
func signingOff(text string) bool {
	inits, off := makersIn(text)

	return off >= inits
}

// And the counting rule itself, on sources written for it. The repo has no file
// with a maker that skips the config — that is the point — so the predicate is
// driven directly rather than by planting a bad fixture in the tree.
func TestTheSigningPinCountsEveryMaker(t *testing.T) {
	cases := []struct {
		name   string
		text   string
		enough bool
	}{
		{"one maker, signing off", `{"init", "-b", "main"}, {"config", "commit.gpgsign", "false"}`, true},
		{"one maker, signing left on", `{"init", "-b", "main"}`, false},
		{"two makers, one config call", `{"init"} ... {"init"} ... {"config", "commit.gpgsign", "false"}`, false},
		{"two makers, two config calls",
			`{"init"} {"config", "commit.gpgsign", "false"} {"init"} {"config", "commit.gpgsign", "false"}`, true},
		{"no maker at all", `nothing about git here`, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			inits, off := makersIn(c.text)
			if enough := signingOff(c.text); enough != c.enough {
				t.Fatalf("%d makers and %d config calls read as enough=%v, want %v",
					inits, off, enough, c.enough)
			}
		})
	}
}
