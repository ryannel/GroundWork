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

	// The section slice 8 fills, and the line standing in it until then.
	gradingHeading     = "## The grading record"
	gradingPlaceholder = "Written by the slice 8 grading dispatch. Empty until then."

	// The heading this proof's from: anchor names.
	holdoutAnchor = "### R11 — Held-out fixtures for bet 3"
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
}
