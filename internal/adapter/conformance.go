package adapter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
)

// KeyFile is the answer key a fixture pack carries at its root.
//
// The key is what makes conformance a test rather than a mirror. Without it,
// the only source of truth about a pack would be the adapter under test, and
// an adapter that reported nothing would pass by agreeing with itself.
const KeyFile = "groundwork-pack.json"

// Key is a fixture pack's answer key: what a conforming adapter must find in
// it.
type Key struct {
	// Stack is the stack the pack is written in, for the report.
	Stack string `json:"stack"`

	Suites   []KeySuite   `json:"suites"`
	Outcomes []KeyOutcome `json:"outcomes"`
	Mutants  KeyMutants   `json:"mutants"`
}

// KeySuite is one suite the pack holds, and the tests in it.
type KeySuite struct {
	ID    string   `json:"id"`
	Tests []string `json:"tests"`
}

// KeyOutcome is how one test in the pack must come out. The pack ships a
// failing test on purpose: an adapter that cannot tell pass from fail is worse
// than none.
type KeyOutcome struct {
	Suite   string  `json:"suite"`
	Test    string  `json:"test"`
	Outcome Outcome `json:"outcome"`
}

// KeyMutants is the file the pack's mutation targets live in, their names, and
// the one mutation that must be proved to bite.
type KeyMutants struct {
	File    string   `json:"file"`
	Targets []string `json:"targets"`

	// Kills names one target and the test that must go red when that target is
	// blanked. It is what separates a mutator from a cosmetic one.
	Kills KeyKill `json:"kills"`
}

// KeyKill is one mutation and the test it must kill.
type KeyKill struct {
	Target string `json:"target"`
	Suite  string `json:"suite"`
	Test   string `json:"test"`
}

// T is the part of *testing.T conformance needs. It is an interface so that a
// lying adapter can be run through the suite without failing the test that
// runs it — and so this package never imports testing.
type T interface {
	Helper()
	Errorf(format string, args ...any)
}

// conformance runs the conformance suite for one adapter against one fixture
// pack, reporting every problem it finds.
//
// D25: every adapter passes one conformance suite against a shipped fixture
// pack. Both shipped adapters run this, and so does any adapter a project
// writes.
func conformance(t T, a Adapter, dir string) {
	t.Helper()

	for _, problem := range Check(a, dir) {
		t.Errorf("%s", problem)
	}
}

// Check runs the conformance suite and returns what was wrong, in the order it
// was found. An empty list is a pass.
//
// It is separate from conformance so that the suite can be proved: a lying
// adapter must fail conformance, and the test that proves it needs the
// problems as values rather than as failures of its own.
func Check(a Adapter, dir string) []string {
	key, err := ReadKey(dir)
	if err != nil {
		return []string{err.Error()}
	}

	suites, problems := checkDiscover(a, dir, key)

	log, ranProblems := checkRun(a, dir, key)
	problems = append(problems, ranProblems...)

	problems = append(problems, checkAgreement(suites, log)...)
	problems = append(problems, checkMutants(a, dir, key)...)

	return problems
}

// checkAgreement holds the two sides of D30's reconciliation together on the
// fixture pack.
//
// Discovered minus ran is the never-run set, and ran minus discovered is a
// defect in discovery. Both are red in a real project. On a pack with nothing
// tagged out and no gate closed, they must agree exactly, or the adapter is
// reading one of the two sides wrong.
func checkAgreement(suites []Suite, log RunLog) []string {
	if suites == nil || log.Tests == nil {
		return nil
	}

	var discovered []string
	for _, s := range suites {
		for _, name := range s.Tests {
			discovered = append(discovered, TestID(s.ID, name))
		}
	}

	var ran []string
	for _, tr := range log.Tests {
		ran = append(ran, tr.ID)
	}

	problems := missingAndExtra("run", "discovered test", discovered, ran)
	for i, problem := range problems {
		// The plain words matter here: this is the reconciliation the never-run
		// scan is built on, and a reader needs to know which side is short.
		problems[i] = strings.Replace(problem, "run missed the discovered test",
			"a discovered test never ran:", 1)
		problems[i] = strings.Replace(problems[i], "run invented the discovered test",
			"a test ran that discovery never found:", 1)
	}

	return problems
}

// ReadKey reads a fixture pack's answer key.
func ReadKey(dir string) (Key, error) {
	path := filepath.Join(dir, KeyFile)

	raw, err := os.ReadFile(path)
	if err != nil {
		return Key{}, fmt.Errorf("the fixture pack %s has no answer key: %v", dir, err)
	}

	var key Key
	if err := json.Unmarshal(raw, &key); err != nil {
		return Key{}, fmt.Errorf("the answer key %s is not valid JSON: %v", path, err)
	}
	if len(key.Suites) == 0 || len(key.Outcomes) == 0 || len(key.Mutants.Targets) == 0 {
		return Key{}, fmt.Errorf("the answer key %s claims nothing, so it can prove nothing", path)
	}
	if key.Mutants.Kills.Target == "" || key.Mutants.Kills.Test == "" {
		return Key{}, fmt.Errorf("the answer key %s names no mutation that must kill a test", path)
	}

	return key, nil
}

// checkDiscover judges the discover call against the key, and returns what it
// found so the run can be reconciled against it.
func checkDiscover(a Adapter, dir string, key Key) ([]Suite, []string) {
	suites, err := a.Discover(context.Background(), dir)
	if err != nil {
		return nil, []string{fmt.Sprintf("discover failed: %v", err)}
	}

	var problems []string

	found := map[string][]string{}
	for _, s := range suites {
		if _, twice := found[s.ID]; twice {
			// Two entries under one id would let the second quietly replace the
			// first, and a suite that vanished that way is a suite nothing
			// reconciles.
			problems = append(problems, fmt.Sprintf("discover returned the suite %s twice", s.ID))
		}
		found[s.ID] = s.Tests
	}

	for _, want := range key.Suites {
		tests, ok := found[want.ID]
		if !ok {
			problems = append(problems, fmt.Sprintf("discover missed the suite %s", want.ID))
			continue
		}
		problems = append(problems, missingAndExtra(
			fmt.Sprintf("discover in the suite %s", want.ID), "test", want.Tests, tests)...)
	}

	var extra []string
	for id := range found {
		if !slices.ContainsFunc(key.Suites, func(s KeySuite) bool { return s.ID == id }) {
			extra = append(extra, id)
		}
	}
	sort.Strings(extra)
	for _, id := range extra {
		problems = append(problems, fmt.Sprintf("discover invented the suite %s", id))
	}

	return suites, problems
}

// checkRun judges the run call against the key, and returns the log so the two
// sides can be reconciled.
func checkRun(a Adapter, dir string, key Key) (RunLog, []string) {
	log, err := a.Run(context.Background(), dir)
	if err != nil {
		return RunLog{}, []string{fmt.Sprintf("run failed: %v", err)}
	}

	var problems []string

	if log.Duration <= 0 {
		problems = append(problems, "run reported no duration for the whole run")
	}

	ran := map[string]TestRun{}
	for _, tr := range log.Tests {
		ran[tr.ID] = tr
	}

	for _, want := range key.Outcomes {
		id := TestID(want.Suite, want.Test)
		got, ok := ran[id]
		if !ok {
			problems = append(problems, fmt.Sprintf("run reported no test %s", id))
			continue
		}
		if got.Outcome != want.Outcome {
			problems = append(problems, fmt.Sprintf("run reported %s as %s, and the pack says %s",
				id, got.Outcome, want.Outcome))
		}
		if got.Duration < 0 {
			problems = append(problems, fmt.Sprintf("run reported %s with a duration of %s", id, got.Duration))
		}
	}

	var extra []string
	for id := range ran {
		if !slices.ContainsFunc(key.Outcomes, func(o KeyOutcome) bool { return TestID(o.Suite, o.Test) == id }) {
			extra = append(extra, id)
		}
	}
	sort.Strings(extra)
	for _, id := range extra {
		problems = append(problems, fmt.Sprintf("run reported the test %s, which the pack does not hold", id))
	}

	return log, problems
}

// checkMutants judges the mutants call against the key.
func checkMutants(a Adapter, dir string, key Key) []string {
	mutants, err := a.Mutants(context.Background(), dir, key.Mutants.File)
	if err != nil {
		return []string{fmt.Sprintf("mutants failed: %v", err)}
	}

	original, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(key.Mutants.File)))
	if err != nil {
		return []string{fmt.Sprintf("the pack's mutation target %s cannot be read: %v", key.Mutants.File, err)}
	}

	var got []string
	for _, m := range mutants {
		got = append(got, m.Symbol)
	}

	problems := missingAndExtra("mutants", "mutant", key.Mutants.Targets, got)

	seen := map[string]string{}
	for _, m := range mutants {
		switch {
		case strings.TrimSpace(m.Content) == "":
			problems = append(problems, fmt.Sprintf("the mutant of %s is empty", m.Symbol))
		case m.Content == string(original):
			problems = append(problems, fmt.Sprintf("the mutant of %s changes nothing", m.Symbol))
		}
		if other, ok := seen[m.Content]; ok {
			problems = append(problems, fmt.Sprintf("the mutants of %s and %s are the same file", other, m.Symbol))
		}
		seen[m.Content] = m.Symbol

		if m.File != key.Mutants.File {
			problems = append(problems, fmt.Sprintf("the mutant of %s names the file %s, want %s",
				m.Symbol, m.File, key.Mutants.File))
		}
	}

	return append(problems, checkTheMutantBites(a, dir, key, mutants)...)
}

// checkTheMutantBites applies one mutant to a copy of the pack and re-runs it.
// The test the key names must go from pass to fail.
//
// This is the check that separates a mutator from a cosmetic one. A mutant that
// only reformats the file, renames a variable, or hands back the original
// content passes every check above it: the content differs, the targets match,
// the file is right. Only running it shows that nothing was actually broken —
// and a deletion test built on a cosmetic mutator would report a suite as
// sound when the suite proves nothing.
func checkTheMutantBites(a Adapter, dir string, key Key, mutants []Mutant) []string {
	kill := key.Mutants.Kills
	want := TestID(kill.Suite, kill.Test)

	var chosen *Mutant
	for i, m := range mutants {
		if m.Symbol == kill.Target {
			chosen = &mutants[i]
			break
		}
	}
	if chosen == nil {
		return []string{fmt.Sprintf("mutants returned nothing for %s, so the mutation that must kill %s cannot be run",
			kill.Target, want)}
	}

	copied, err := copyDir(dir)
	if err != nil {
		return []string{fmt.Sprintf("the pack could not be copied to run the mutant of %s: %v", kill.Target, err)}
	}
	defer os.RemoveAll(copied)

	target := filepath.Join(copied, filepath.FromSlash(chosen.File))
	if err := os.WriteFile(target, []byte(chosen.Content), 0o600); err != nil {
		return []string{fmt.Sprintf("the mutant of %s could not be written: %v", kill.Target, err)}
	}

	log, err := a.Run(context.Background(), copied)
	if err != nil {
		// A mutant that will not build or run is inconclusive, never a catch
		// (D26). It is still a conformance problem: the pack names this one
		// mutation because it must be the one that runs.
		return []string{fmt.Sprintf("the pack does not run with the mutant of %s applied: %v", kill.Target, err)}
	}

	for _, tr := range log.Tests {
		if tr.ID != want {
			continue
		}
		if tr.Outcome != Fail {
			return []string{fmt.Sprintf("blanking %s left %s reporting %s: the mutant changes nothing that matters",
				kill.Target, want, tr.Outcome)}
		}

		return nil
	}

	return []string{fmt.Sprintf("blanking %s left %s out of the run log entirely", kill.Target, want)}
}

// copyDir copies a fixture pack into a fresh temp directory, so a mutant can be
// applied without touching the pack this repo ships.
func copyDir(from string) (string, error) {
	to, err := os.MkdirTemp("", "groundwork-pack-")
	if err != nil {
		return "", err
	}

	err = filepath.WalkDir(from, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(from, p)
		if err != nil {
			return err
		}
		target := filepath.Join(to, rel)

		if d.IsDir() {
			return os.MkdirAll(target, 0o750)
		}

		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}

		return os.WriteFile(target, raw, 0o600)
	})
	if err != nil {
		os.RemoveAll(to)

		return "", err
	}

	return to, nil
}

// missingAndExtra reports what the key holds and the adapter did not, and what
// the adapter reported and the key does not hold.
func missingAndExtra(what, noun string, want, got []string) []string {
	var problems []string

	have := map[string]bool{}
	for _, g := range got {
		have[g] = true
	}
	wanted := map[string]bool{}
	for _, w := range want {
		wanted[w] = true
	}

	for _, w := range want {
		if !have[w] {
			problems = append(problems, fmt.Sprintf("%s missed the %s %s", what, noun, w))
		}
	}

	var extra []string
	for g := range have {
		if !wanted[g] {
			extra = append(extra, g)
		}
	}
	sort.Strings(extra)
	for _, g := range extra {
		problems = append(problems, fmt.Sprintf("%s invented the %s %s", what, noun, g))
	}

	return problems
}
