package battery

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// R11's grading run. Bet 3 is graded against fixtures nobody who built its
// checks ever saw. Slice 8 runs that sealed set once and writes what it said.
//
// This proof lives beside the record row because it is a proof about a record:
// the slice plan declares docs/evidence/bet-3/holdout.md, and the page's
// grading section is the thing the slice owes. The record row asks whether the
// page was touched. This asks whether the grading is on it.
const (
	holdoutPageAt = "docs/evidence/bet-3/holdout.md"
	designPageAt  = "docs/evidence/bet-3/design.md"

	// The runner's record. The grading page says what the runs meant; this
	// page is what the runs said. A grading with no run record behind it is
	// prose, so this proof reads both.
	runsPageAt = "docs/evidence/bet-3/slice-8/runs.md"

	// The section slice 8 fills, and the line standing in it until then.
	gradingHeading     = "## The grading record"
	gradingPlaceholder = "Written by the slice 8 grading dispatch. Empty until then."

	// The heading this proof's from: anchor names.
	holdoutAnchor = "### R11 — Held-out fixtures for bet 3"

	// The battery that ran the fixtures. A run record that does not say which
	// version spoke cannot be held to anything later.
	runBattery = "12.0+ra48a79a"

	// The heading the supplemental walk lives under. The graded runs asked two
	// of bet 3's four done-when clauses; the walk asked the other two. F123.
	supplementHeading = "## The supplemental runs"

	// What a captured run looks like on the page: a fence opened straight
	// after the word verbatim. Prose about a run does not match this.
	verbatimFence = "verbatim:\n\n```\n"

	// The four graded runs: board and verify, on each of the two fixtures.
	// Fewer captured blocks than that means a run went unrecorded.
	gradedRuns = 4
)

// The two sealed repos. A grading that names neither graded nothing.
var sealedRepos = []string{"holdout3-go-sift", "holdout3-go-gauge"}

// repoPage reads a page of this repo from the repo root, however deep this
// package sits.
func repoPage(t *testing.T, at string) string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "..", filepath.FromSlash(at)))
	if err != nil {
		t.Fatalf("%s did not read: %v", at, err)
	}

	return string(raw)
}

// sectionAfter returns the body a heading line opens, up to the next heading of
// the same depth. It returns the empty string when the page holds no such
// heading, which is its own failure and not an empty section.
func sectionAfter(page, heading string) (string, bool) {
	at := strings.Index(page, heading+"\n")
	if at < 0 {
		return "", false
	}

	body := page[at+len(heading)+1:]
	if end := strings.Index(body, "\n## "); end >= 0 {
		body = body[:end]
	}

	return body, true
}

// TestProof_b3s8_grading_the_sealed_fixtures_are_run_once is R11's half of this
// slice. The held-out set is run once through the built binary, and what it
// said is written down where the rules said it would be.
//
// It is red while the grading section holds nothing but its placeholder line.
// That is the honest shape: the run is the work, and a record nobody wrote is
// indistinguishable from a run nobody made.
func TestProof_b3s8_grading_the_sealed_fixtures_are_run_once(t *testing.T) {
	// The from: anchor first. A proof pinned to a heading nobody wrote points
	// at nothing, whatever the rest of it finds.
	design := repoPage(t, designPageAt)
	if !strings.Contains(design, holdoutAnchor) {
		t.Errorf("%s holds no heading %q, and this proof's from: anchor names it",
			designPageAt, holdoutAnchor)
	}

	page := repoPage(t, holdoutPageAt)

	body, found := sectionAfter(page, gradingHeading)
	if !found {
		t.Fatalf("%s holds no section titled %q", holdoutPageAt, gradingHeading)
	}

	if strings.Contains(body, gradingPlaceholder) {
		t.Fatalf("the grading record still stands at its placeholder, so no run has been graded: %q",
			gradingPlaceholder)
	}

	// A section emptied of its placeholder is not a grading either. Twenty
	// words is a low bar, and it is well under anything a real grading runs to.
	if words := len(strings.Fields(body)); words < 20 {
		t.Fatalf("the grading record holds %d words, which is not a grading", words)
	}

	// Both sealed repos are graded, so the record says which fixtures were run.
	for _, repo := range sealedRepos {
		if !strings.Contains(body, repo) {
			t.Errorf("the grading record never names %s", repo)
		}
	}

	// The grading page alone cannot show that a run happened. F128: this proof
	// used to read prose and call it a run. The run record is the other half,
	// so it is read here too.
	runs := repoPage(t, runsPageAt)

	for _, repo := range sealedRepos {
		if !strings.Contains(runs, repo) {
			t.Errorf("%s never names %s, so it records no run on that fixture",
				runsPageAt, repo)
		}
	}

	if !strings.Contains(runs, runBattery) {
		t.Errorf("%s never names the battery %s, so no run on it is pinned to a version",
			runsPageAt, runBattery)
	}

	if blocks := strings.Count(runs, verbatimFence); blocks < gradedRuns {
		t.Errorf("%s holds %d captured run blocks, and the graded runs alone are %d",
			runsPageAt, blocks, gradedRuns)
	}

	if !strings.Contains(runs, supplementHeading) {
		t.Errorf("%s holds no section %q, so the two clauses F123 names went unasked",
			runsPageAt, supplementHeading)
	}
}
