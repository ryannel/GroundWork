package findings

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ledger builds a fixture ledger: the file's own heading and blurb, then the
// entries given, in order.
func ledger(entries ...string) string {
	var b strings.Builder

	b.WriteString("# Findings\n\nThis file is the defects ledger. It is append-only.\n\n")
	for _, e := range entries {
		b.WriteString(e)
	}

	return b.String()
}

// entry builds one fixture entry: a heading, one line of prose, then the
// lines given, which are usually the labels.
func entry(id, title string, rest ...string) string {
	lines := []string{
		"## " + id + " — 2026-08-22 — " + title,
		"",
		"What it is: something went wrong.",
		"",
	}
	lines = append(lines, rest...)

	return strings.Join(lines, "\n") + "\n\n"
}

// good is one well-formed entry, for ledgers where only one thing is under
// test and everything else has to be right.
func good(id string) string {
	return entry(id, "A well-formed finding",
		"Caught by: blind-review — the slice's review",
		"Class: register")
}

// threeOf builds a parsed ledger holding three findings of one class: the
// recurrence threshold, exactly.
func threeOf(class string) Ledger {
	return Parse(ledger(
		entry("F1", "One", "Caught by: driver — a check", "Class: "+class),
		entry("F2", "Two", "Caught by: driver — a check", "Class: "+class),
		entry("F3", "Three", "Caught by: driver — a check", "Class: "+class),
	))
}

// problemText joins problems into one string, so a test can say what it
// wants to see without pinning the order of every other problem.
func problemText(problems []Problem) string {
	parts := make([]string, len(problems))
	for i, p := range problems {
		parts[i] = p.Where + ": " + p.Text
	}

	return strings.Join(parts, "\n")
}

// onlyEntry parses a ledger and returns its single entry, failing the test if
// the ledger did not hold exactly one.
func onlyEntry(t *testing.T, text string) Entry {
	t.Helper()

	l := Parse(text)
	if len(l.Entries) != 1 {
		t.Fatalf("Parse returned %d entries, want 1: %+v", len(l.Entries), l.Entries)
	}

	return l.Entries[0]
}

// onlyClass returns an entry's single class line, failing the test if the
// entry did not hold exactly one.
func onlyClass(t *testing.T, e Entry) ClassLine {
	t.Helper()

	if len(e.Classes) != 1 {
		t.Fatalf("the entry holds %d class lines, want 1: %+v", len(e.Classes), e.Classes)
	}

	return e.Classes[0]
}

func TestParseReadsEveryField(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F7", "The writer's first build",
		"Caught by: blind-review — slice 1's mutation review",
		"Class: green-but-wrong")))

	if e.ID != "F7" {
		t.Errorf("ID is %q, want %q", e.ID, "F7")
	}
	if e.Title != "The writer's first build" {
		t.Errorf("Title is %q, want %q", e.Title, "The writer's first build")
	}
	if e.Catcher != "blind-review" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "blind-review")
	}
	if e.Detail != "slice 1's mutation review" {
		t.Errorf("Detail is %q, want %q", e.Detail, "slice 1's mutation review")
	}

	c := onlyClass(t, e)
	if c.Class != "green-but-wrong" {
		t.Errorf("Class is %q, want %q", c.Class, "green-but-wrong")
	}
	if c.Reason != "" {
		t.Errorf("Reason is %q, want it empty", c.Reason)
	}
}

func TestParseReadsTheReasonOnAnOtherClass(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F1", "A tag that exists only locally",
		"Caught by: driver — the ratification push failure",
		"Class: other — a host proxy limitation, not a code defect")))

	c := onlyClass(t, e)
	if c.Class != "other" {
		t.Errorf("Class is %q, want %q", c.Class, "other")
	}
	if want := "a host proxy limitation, not a code defect"; c.Reason != want {
		t.Errorf("Reason is %q, want %q", c.Reason, want)
	}
}

func TestParseReadsSeveralEntriesInOrder(t *testing.T) {
	l := Parse(ledger(good("F1"), good("F2"), good("F3")))

	if len(l.Entries) != 3 {
		t.Fatalf("Parse returned %d entries, want 3", len(l.Entries))
	}
	for i, want := range []string{"F1", "F2", "F3"} {
		if l.Entries[i].ID != want {
			t.Errorf("entry %d has ID %q, want %q", i, l.Entries[i].ID, want)
		}
	}
}

// A detail may hold em dashes of its own. The catcher is the part before the
// first one, and everything after it is the detail.
func TestParseSplitsTheDetailAtTheFirstEmDash(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F4", "Two defects in the CI pin",
		"Caught by: blind-review — slice 0.4's review — the second round",
		"Class: other — a note — with its own dash")))

	if e.Catcher != "blind-review" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "blind-review")
	}
	if want := "slice 0.4's review — the second round"; e.Detail != want {
		t.Errorf("Detail is %q, want %q", e.Detail, want)
	}

	c := onlyClass(t, e)
	if c.Class != "other" {
		t.Errorf("Class is %q, want %q", c.Class, "other")
	}
	if want := "a note — with its own dash"; c.Reason != want {
		t.Errorf("Reason is %q, want %q", c.Reason, want)
	}
}

// A ledger written on Windows, or edited by a tool that rewrites endings,
// reads the same as one written with bare newlines.
func TestParseReadsACRLFLedger(t *testing.T) {
	text := ledger(entry("F2", "Stale counts in the ladder",
		"Caught by: driver — the ratification read",
		"Class: record-not-written"))

	e := onlyEntry(t, strings.ReplaceAll(text, "\n", "\r\n"))

	if e.Catcher != "driver" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "driver")
	}
	if e.Detail != "the ratification read" {
		t.Errorf("Detail is %q, want %q", e.Detail, "the ratification read")
	}
	if c := onlyClass(t, e); c.Class != "record-not-written" {
		t.Errorf("Class is %q, want %q", c.Class, "record-not-written")
	}
}

// The labels are not required to be the last lines. F1 in the real ledger
// carries a Resolved line, and the labels sit after it.
func TestParseFindsLabelsAfterALaterLine(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F1", "A tag that exists only locally",
		"What happened: open.",
		"",
		"Resolved 2026-08-22: the owner pushed the tag.",
		"",
		"Caught by: driver — the push failure",
		"Class: other — a host limitation")))

	if e.Catcher != "driver" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "driver")
	}
	if c := onlyClass(t, e); c.Class != "other" {
		t.Errorf("Class is %q, want %q", c.Class, "other")
	}
}

// A label sitting in the middle of an entry, with prose after it, still
// counts. The parser reads labels by where they start, not by where they sit.
func TestParseFindsLabelsInTheMiddleOfProse(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F5", "A commit on the wrong branch",
		"Caught by: driver — the commit output naming the wrong branch",
		"Class: other — a git slip",
		"",
		"What happened: the commit was reset away and redone on the bet branch.")))

	if e.Catcher != "driver" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "driver")
	}
	if c := onlyClass(t, e); c.Reason != "a git slip" {
		t.Errorf("Reason is %q, want %q", c.Reason, "a git slip")
	}
}

// A label must start its line. The words "Caught by:" inside a sentence are
// prose, not a label, and must not be read as one.
func TestParseIgnoresALabelThatDoesNotStartItsLine(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F6", "The port list needed two rounds",
		"What caught it: the driver. Caught by: worker — not a label at all.",
		"",
		"Caught by: blind-review — the register review",
		"Class: register")))

	if e.Catcher != "blind-review" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "blind-review")
	}
	if e.CaughtByLines != 1 {
		t.Errorf("CaughtByLines is %d, want 1", e.CaughtByLines)
	}
}

// An entry heading may hold any text at all, including characters outside
// ASCII and em dashes inside the title itself.
func TestParseReadsAUnicodeHeading(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F12", "Ünicode — naïve café ✓",
		"Caught by: ci — the gating step",
		"Class: coverage-gap")))

	if e.ID != "F12" {
		t.Errorf("ID is %q, want %q", e.ID, "F12")
	}
	if want := "Ünicode — naïve café ✓"; e.Title != want {
		t.Errorf("Title is %q, want %q", e.Title, want)
	}
}

// Only a heading naming F and a number opens an entry. The file's own
// headings are not findings, and labels under one belong to no entry.
func TestParseIgnoresHeadingsThatAreNotFindings(t *testing.T) {
	text := ledger(good("F1")) + "## How to read this file\n\n" +
		"Caught by: driver — this belongs to no entry\n" +
		"Class: register\n"

	l := Parse(text)
	if len(l.Entries) != 1 {
		t.Fatalf("Parse returned %d entries, want 1: %+v", len(l.Entries), l.Entries)
	}
	if l.Entries[0].ID != "F1" {
		t.Errorf("ID is %q, want %q", l.Entries[0].ID, "F1")
	}
	if l.Entries[0].CaughtByLines != 1 {
		t.Errorf("CaughtByLines is %d, want 1: labels under a later heading are not this entry's",
			l.Entries[0].CaughtByLines)
	}
	if len(l.BadHeadings) != 0 {
		t.Errorf("Parse called %+v a bad heading, and it does not mean to be a finding", l.BadHeadings)
	}
}

func TestParseCountsRepeatedCaughtByLines(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F8", "Two of everything",
		"Caught by: driver — the first line",
		"Caught by: worker — the second line",
		"Class: register")))

	if e.CaughtByLines != 2 {
		t.Errorf("CaughtByLines is %d, want 2", e.CaughtByLines)
	}
	// The first line is the one kept, so a reader of the entry is never
	// handed the later line as though it stood alone.
	if e.Catcher != "driver" {
		t.Errorf("Catcher is %q, want the first line's %q", e.Catcher, "driver")
	}
}

// A heading that means to be an entry heading, and is not one, is named
// rather than passed over. A finding written at the wrong level would
// otherwise drop out of every count without a word.
func TestParseNamesAHeadingThatMeansToBeAnEntry(t *testing.T) {
	cases := []struct {
		name    string
		heading string
	}{
		{"one hash", "# F12 — 2026-08-22 — A finding at the wrong level"},
		{"three hashes", "### F12 — 2026-08-22 — A finding at the wrong level"},
		{"four hashes", "#### F12 — 2026-08-22 — A finding at the wrong level"},
		{"no space after the hashes", "##F12 — 2026-08-22 — A finding with no space"},
		{"two spaces after the hashes", "##  F12 — 2026-08-22 — A finding with two spaces"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			l := Parse(ledger(good("F1")) + c.heading + "\n\nCaught by: ci — a check\nClass: register\n")

			if len(l.Entries) != 1 {
				t.Fatalf("Parse returned %d entries, want 1: the bad heading must not open one", len(l.Entries))
			}
			if len(l.BadHeadings) != 1 {
				t.Fatalf("Parse returned %d bad headings, want 1: %+v", len(l.BadHeadings), l.BadHeadings)
			}
			if l.BadHeadings[0].Text != c.heading {
				t.Errorf("the bad heading is %q, want %q", l.BadHeadings[0].Text, c.heading)
			}

			problems := Check(l)
			if len(problems) != 1 {
				t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
			}
			if !strings.Contains(problems[0].Text, c.heading) {
				t.Errorf("the problem says %q, want it to quote the heading", problems[0].Text)
			}
			if problems[0].Line != l.BadHeadings[0].Line {
				t.Errorf("the problem points at line %d, want line %d", problems[0].Line, l.BadHeadings[0].Line)
			}
		})
	}
}

// A well-formed entry heading is never called a bad one.
func TestParseAcceptsTheRealHeadingForm(t *testing.T) {
	l := Parse(ledger(good("F1"), good("F2")))

	if len(l.BadHeadings) != 0 {
		t.Errorf("Parse called %+v bad headings", l.BadHeadings)
	}
}

// A fenced code block may quote the ledger's own format. Nothing inside it
// is a heading, an entry or a label.
func TestParseSkipsAnEntryHeadingInsideAFence(t *testing.T) {
	text := "# Findings\n\n" +
		"## F1 — 2026-08-22 — One\n\n" +
		"What it is: this entry shows the format.\n\n" +
		"```\n" +
		"## F9 — 2026-08-22 — Not a real finding\n" +
		"Caught by: worker — not a real label\n" +
		"Class: coverage-gap\n" +
		"```\n\n" +
		"Caught by: driver — the real label\n" +
		"Class: register\n"

	l := Parse(text)

	if len(l.Entries) != 1 {
		t.Fatalf("Parse returned %d entries, want 1: %+v", len(l.Entries), l.Entries)
	}
	if len(l.BadHeadings) != 0 {
		t.Errorf("Parse called %+v a bad heading, and it is inside a fence", l.BadHeadings)
	}

	e := l.Entries[0]
	if e.ID != "F1" {
		t.Errorf("ID is %q, want %q", e.ID, "F1")
	}
	// The fence's labels did not count, and the fence's heading did not
	// close the entry: the real labels below it still belong to F1.
	if e.CaughtByLines != 1 {
		t.Errorf("CaughtByLines is %d, want 1: a fenced label must not count", e.CaughtByLines)
	}
	if e.Catcher != "driver" {
		t.Errorf("Catcher is %q, want %q", e.Catcher, "driver")
	}
	if c := onlyClass(t, e); c.Class != "register" {
		t.Errorf("Class is %q, want %q", c.Class, "register")
	}
	if problems := Check(l); len(problems) > 0 {
		t.Errorf("Check found problems in a ledger that only quotes itself:\n%s", problemText(problems))
	}
}

// A bad heading inside a fence is quoted text, not a mistake.
func TestParseSkipsABadHeadingInsideAFence(t *testing.T) {
	text := ledger(good("F1")) + "```\n### F9 — 2026-08-22 — how not to write one\n```\n"

	l := Parse(text)
	if len(l.BadHeadings) != 0 {
		t.Errorf("Parse returned %+v, want no bad headings from inside a fence", l.BadHeadings)
	}
	if problems := Check(l); len(problems) > 0 {
		t.Errorf("Check found problems:\n%s", problemText(problems))
	}
}

// An entry may hold more than one class: a finding that is both a wrong
// result and an unproven claim records one line for each.
func TestParseReadsSeveralClassLines(t *testing.T) {
	e := onlyEntry(t, ledger(entry("F7", "Two kinds of defect at once",
		"Caught by: blind-review — slice 1's mutation review",
		"Class: green-but-wrong",
		"Class: unrun-proof")))

	if len(e.Classes) != 2 {
		t.Fatalf("the entry holds %d class lines, want 2: %+v", len(e.Classes), e.Classes)
	}
	if e.Classes[0].Class != "green-but-wrong" || e.Classes[1].Class != "unrun-proof" {
		t.Errorf("the classes are %+v, want green-but-wrong then unrun-proof", e.Classes)
	}
	if problems := Check(Parse(ledger(entry("F7", "Two kinds",
		"Caught by: blind-review — a review",
		"Class: green-but-wrong",
		"Class: unrun-proof")))); len(problems) > 0 {
		t.Errorf("Check refused an entry holding two classes:\n%s", problemText(problems))
	}
}

func TestCheckNamesAClassRecordedTwice(t *testing.T) {
	l := Parse(ledger(entry("F1", "One",
		"Caught by: driver — a check",
		"Class: register",
		"Class: register")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if !strings.Contains(problems[0].Text, "twice") {
		t.Errorf("the problem says %q, want it to say the class is recorded twice", problems[0].Text)
	}
}

func TestCheckPassesAGoodLedger(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — the push failure", "Class: other — a host limitation"),
		entry("F2", "Two", "Caught by: blind-review — slice 1's review", "Class: green-but-wrong", "Class: unrun-proof"),
		entry("F3", "Three", "Caught by: ci — the gating step", "Class: coverage-gap"),
	))

	if problems := Check(l); len(problems) > 0 {
		t.Errorf("Check found problems in a good ledger:\n%s", problemText(problems))
	}
}

func TestCheckNamesAnEntryWithNoCaughtByLine(t *testing.T) {
	l := Parse(ledger(good("F1"), entry("F2", "Two", "Class: register")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "F2" {
		t.Errorf("the problem names %q, want %q", problems[0].Where, "F2")
	}
	if !strings.Contains(problems[0].Text, "Caught by") {
		t.Errorf("the problem says %q, want it to name the missing Caught by line", problems[0].Text)
	}
}

func TestCheckNamesACatcherOutsideTheVocabulary(t *testing.T) {
	l := Parse(ledger(good("F1"),
		entry("F2", "Two", "Caught by: reviewer — the slice's review", "Class: register")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "F2" {
		t.Errorf("the problem names %q, want %q", problems[0].Where, "F2")
	}
	if !strings.Contains(problems[0].Text, "reviewer") {
		t.Errorf("the problem says %q, want it to quote the catcher it refused", problems[0].Text)
	}
	if !strings.Contains(problems[0].Text, "blind-review") {
		t.Errorf("the problem says %q, want it to list the catchers that are allowed", problems[0].Text)
	}
}

func TestCheckAcceptsEveryCatcherInTheVocabulary(t *testing.T) {
	for i, catcher := range catchers {
		l := Parse(ledger(entry("F"+string(rune('1'+i)), "One",
			"Caught by: "+catcher+" — a real detail", "Class: register")))

		if problems := Check(l); len(problems) > 0 {
			t.Errorf("Check refused the catcher %q:\n%s", catcher, problemText(problems))
		}
	}
}

func TestCheckNamesAnEmptyDetail(t *testing.T) {
	cases := []struct {
		name  string
		label string
	}{
		{"no em dash at all", "Caught by: driver"},
		{"an em dash with nothing after it", "Caught by: driver —"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			l := Parse(ledger(good("F1"), entry("F2", "Two", c.label, "Class: register")))

			problems := Check(l)
			if len(problems) == 0 {
				t.Fatalf("Check passed the label %q, want it refused", c.label)
			}
			if problems[0].Where != "F2" {
				t.Errorf("the problem names %q, want %q", problems[0].Where, "F2")
			}
			if !strings.Contains(problems[0].Text, "detail") {
				t.Errorf("the problem says %q, want it to name the missing detail", problems[0].Text)
			}
		})
	}
}

// An en dash or a hyphen where the em dash belongs is a typing slip. Saying
// so beats reporting a catcher nobody has heard of, or a detail that is in
// fact right there.
func TestCheckNamesADashVariant(t *testing.T) {
	cases := []struct {
		name  string
		lines []string
		dash  string
	}{
		{"an en dash on the Caught by line", []string{"Caught by: driver – a real check", "Class: register"}, "–"},
		{"a hyphen on the Caught by line", []string{"Caught by: driver - a real check", "Class: register"}, "-"},
		{"an en dash on the Class line", []string{"Caught by: driver — a check", "Class: other – a reason"}, "–"},
		{"a hyphen on the Class line", []string{"Caught by: driver — a check", "Class: other - a reason"}, "-"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			l := Parse(ledger(entry("F1", "One", c.lines...)))

			problems := Check(l)
			if len(problems) != 1 {
				t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
			}
			if !strings.Contains(problems[0].Text, c.dash) {
				t.Errorf("the problem says %q, want it to quote the dash it found", problems[0].Text)
			}
			if !strings.Contains(problems[0].Text, "em dash") {
				t.Errorf("the problem says %q, want it to say an em dash belongs there", problems[0].Text)
			}
			if strings.Contains(problems[0].Text, "no detail") || strings.Contains(problems[0].Text, "no reason") {
				t.Errorf("the problem says %q, and the detail is right there", problems[0].Text)
			}
		})
	}
}

func TestCheckNamesAnEntryWithNoClassLine(t *testing.T) {
	l := Parse(ledger(good("F1"),
		entry("F2", "Two", "Caught by: driver — the pre-push check")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "F2" {
		t.Errorf("the problem names %q, want %q", problems[0].Where, "F2")
	}
	if !strings.Contains(problems[0].Text, "Class") {
		t.Errorf("the problem says %q, want it to name the missing Class line", problems[0].Text)
	}
}

func TestCheckNamesAClassOutsideTheVocabulary(t *testing.T) {
	l := Parse(ledger(good("F1"),
		entry("F2", "Two", "Caught by: driver — the pre-push check", "Class: flaky-test")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if !strings.Contains(problems[0].Text, "flaky-test") {
		t.Errorf("the problem says %q, want it to quote the class it refused", problems[0].Text)
	}
	if !strings.Contains(problems[0].Text, "green-but-wrong") {
		t.Errorf("the problem says %q, want it to list the classes that are allowed", problems[0].Text)
	}
}

func TestCheckAcceptsEveryClassInTheVocabulary(t *testing.T) {
	for _, class := range Classes() {
		line := "Class: " + class
		if class == "other" {
			line += " — a reason"
		}

		l := Parse(ledger(entry("F1", "One", "Caught by: driver — a real detail", line)))

		if problems := Check(l); len(problems) > 0 {
			t.Errorf("Check refused the class %q:\n%s", class, problemText(problems))
		}
	}
}

func TestCheckNamesOtherWithNoReason(t *testing.T) {
	cases := []struct {
		name  string
		label string
	}{
		{"no em dash at all", "Class: other"},
		{"an em dash with nothing after it", "Class: other —"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			l := Parse(ledger(good("F1"),
				entry("F2", "Two", "Caught by: driver — the pre-push check", c.label)))

			problems := Check(l)
			if len(problems) == 0 {
				t.Fatalf("Check passed the label %q, want it refused", c.label)
			}
			if problems[0].Where != "F2" {
				t.Errorf("the problem names %q, want %q", problems[0].Where, "F2")
			}
			if !strings.Contains(problems[0].Text, "reason") {
				t.Errorf("the problem says %q, want it to name the missing reason", problems[0].Text)
			}
		})
	}
}

func TestCheckNamesRepeatedCaughtByLines(t *testing.T) {
	l := Parse(ledger(entry("F1", "One",
		"Caught by: driver — the first line",
		"Caught by: worker — the second line",
		"Class: register")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if !strings.Contains(problems[0].Text, "Caught by") {
		t.Errorf("the problem says %q, want it to name the repeated label", problems[0].Text)
	}
}

// Two findings may not share an id. The ledger is append-only and its ids are
// how everything else in the repo points at a finding.
func TestCheckNamesADuplicateID(t *testing.T) {
	l := Parse(ledger(good("F7"), good("F7")))

	problems := Check(l)
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "F7" {
		t.Errorf("the problem names %q, want %q", problems[0].Where, "F7")
	}
	if !strings.Contains(problems[0].Text, "repeats the id") {
		t.Errorf("the problem says %q, want it to say the id repeats", problems[0].Text)
	}
	if problems[0].Line != l.Entries[1].Line {
		t.Errorf("the problem points at line %d, want the second entry's line %d",
			problems[0].Line, l.Entries[1].Line)
	}
}

// A ledger that parses to nothing is refused rather than passed. An empty
// result almost always means the headings stopped matching, and a check that
// passed on nothing would hide that.
func TestCheckRefusesALedgerWithNoEntries(t *testing.T) {
	problems := Check(Parse("# Findings\n\nNothing here yet.\n"))
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "" {
		t.Errorf("the problem names %q, want it to be about the whole file", problems[0].Where)
	}
	if !strings.Contains(problems[0].Text, "no findings") {
		t.Errorf("the problem says %q, want it to say the ledger holds no findings", problems[0].Text)
	}
}

func TestCheckNamesEveryBadEntry(t *testing.T) {
	l := Parse(ledger(
		good("F1"),
		entry("F2", "Two", "Class: register"),
		entry("F3", "Three", "Caught by: driver — a real detail"),
	))

	problems := Check(l)
	if len(problems) != 2 {
		t.Fatalf("Check found %d problems, want 2:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "F2" || problems[1].Where != "F3" {
		t.Errorf("the problems name %q and %q, want F2 and F3", problems[0].Where, problems[1].Where)
	}
}

// A problem points at the line a reader has to open, not just at the entry.
func TestCheckPointsAtTheLineToFix(t *testing.T) {
	text := "# Findings\n" + // 1
		"\n" + // 2
		"## F1 — 2026-08-22 — One\n" + // 3
		"\n" + // 4
		"Caught by: driver\n" + // 5
		"Class: register\n" // 6

	problems := Check(Parse(text))
	if len(problems) != 1 {
		t.Fatalf("Check found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Line != 5 {
		t.Errorf("the problem points at line %d, want line 5", problems[0].Line)
	}
}

func TestCheckPointsAMissingLabelAtTheHeading(t *testing.T) {
	text := "# Findings\n\n## F1 — 2026-08-22 — One\n\nWhat it is: a thing.\n"

	problems := Check(Parse(text))
	if len(problems) != 2 {
		t.Fatalf("Check found %d problems, want 2:\n%s", len(problems), problemText(problems))
	}
	for _, p := range problems {
		if p.Line != 3 {
			t.Errorf("a problem points at line %d, want the heading's line 3", p.Line)
		}
	}
}

func TestCountSortsByCountThenName(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — d", "Class: register"),
		entry("F2", "Two", "Caught by: driver — d", "Class: other — a reason"),
		entry("F3", "Three", "Caught by: driver — d", "Class: register"),
		entry("F4", "Four", "Caught by: driver — d", "Class: other — a reason"),
		entry("F5", "Five", "Caught by: driver — d", "Class: green-but-wrong"),
		entry("F6", "Six", "Caught by: driver — d", "Class: green-but-wrong"),
		entry("F7", "Seven", "Caught by: driver — d", "Class: green-but-wrong"),
	))

	counts := Count(l)
	want := []ClassCount{
		{Class: "green-but-wrong", Count: 3},
		{Class: "other", Count: 2},
		{Class: "register", Count: 2},
	}
	if len(counts) != len(want) {
		t.Fatalf("Count returned %+v, want %+v", counts, want)
	}
	for i := range want {
		if counts[i] != want[i] {
			t.Errorf("count %d is %+v, want %+v", i, counts[i], want[i])
		}
	}
}

// A finding that holds two classes counts once under each. The pair of a
// finding and a class is the thing being counted.
func TestCountCountsEachEntryClassPairOnce(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — d", "Class: green-but-wrong", "Class: unrun-proof"),
		entry("F2", "Two", "Caught by: driver — d", "Class: green-but-wrong", "Class: unrun-proof"),
		entry("F3", "Three", "Caught by: driver — d", "Class: green-but-wrong"),
	))

	counts := Count(l)
	want := []ClassCount{
		{Class: "green-but-wrong", Count: 3},
		{Class: "unrun-proof", Count: 2},
	}
	if len(counts) != len(want) {
		t.Fatalf("Count returned %+v, want %+v", counts, want)
	}
	for i := range want {
		if counts[i] != want[i] {
			t.Errorf("count %d is %+v, want %+v", i, counts[i], want[i])
		}
	}
}

// An entry that writes the same class twice still counts once. Check refuses
// the entry; the counter must not double it in the meantime.
func TestCountCountsARepeatedClassOnce(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — d", "Class: register", "Class: register"),
	))

	counts := Count(l)
	if len(counts) != 1 || counts[0].Count != 1 {
		t.Fatalf("Count returned %+v, want register at 1", counts)
	}
}

// Three findings of one class is the threshold. A class that reaches it must
// be answered by a decision named from it.
func TestRecurFailsAnOverThresholdClassWithNoDecision(t *testing.T) {
	l := threeOf("green-but-wrong")

	counts, problems := Recur(l, "# Decisions\n\nNothing about that class here.\n")
	if len(counts) != 1 || counts[0].Count != 3 {
		t.Fatalf("Count returned %+v, want green-but-wrong at 3", counts)
	}
	if len(problems) != 1 {
		t.Fatalf("Recur found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "green-but-wrong" {
		t.Errorf("the problem names %q, want %q", problems[0].Where, "green-but-wrong")
	}
	if !strings.Contains(problems[0].Text, "3") {
		t.Errorf("the problem says %q, want it to give the count", problems[0].Text)
	}
}

func TestRecurPassesAnOverThresholdClassNamedInADecisionHeading(t *testing.T) {
	l := threeOf("green-but-wrong")

	decisions := "# Decisions\n\n## D18 — the green-but-wrong class tripped its threshold\n"

	_, problems := Recur(l, decisions)
	if len(problems) > 0 {
		t.Errorf("Recur found problems though a decision is named from the class:\n%s", problemText(problems))
	}
}

// A class reaches the threshold through second class lines as readily as
// through first ones.
func TestRecurCountsASecondClassTowardTheThreshold(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — d", "Class: green-but-wrong", "Class: unrun-proof"),
		entry("F2", "Two", "Caught by: driver — d", "Class: green-but-wrong", "Class: unrun-proof"),
		entry("F3", "Three", "Caught by: driver — d", "Class: green-but-wrong", "Class: unrun-proof"),
	))

	counts, problems := Recur(l, "# Decisions\n\n## D18 — the green-but-wrong class tripped its threshold\n")

	found := false
	for _, c := range counts {
		if c.Class == "unrun-proof" && c.Count == 3 {
			found = true
		}
	}
	if !found {
		t.Fatalf("Count returned %+v, want unrun-proof at 3", counts)
	}
	if len(problems) != 1 || problems[0].Where != "unrun-proof" {
		t.Fatalf("Recur found %v, want one problem naming unrun-proof", problemText(problems))
	}
}

func TestRecurPassesAClassBelowTheThreshold(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — d", "Class: register"),
		entry("F2", "Two", "Caught by: driver — d", "Class: register"),
	))

	counts, problems := Recur(l, "# Decisions\n\nNothing here.\n")
	if len(counts) != 1 || counts[0].Count != 2 {
		t.Fatalf("Count returned %+v, want register at 2", counts)
	}
	if len(problems) > 0 {
		t.Errorf("Recur failed a class at 2, below the threshold of %d:\n%s",
			Threshold, problemText(problems))
	}
}

// A class name buried inside a longer word is not a mention of that class.
// "register" is a real class and a common English word, so the match has to
// stop at word edges or the check would pass on a heading that says nothing.
func TestRecurIgnoresAClassNameInsideAWord(t *testing.T) {
	l := threeOf("register")

	cases := []struct {
		name      string
		decisions string
	}{
		{"a longer word", "# Decisions\n\n## D5 — the port list was registered\n"},
		{"a longer class name", "# Decisions\n\n## D5 — the registers-late class is ruled here\n"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, problems := Recur(l, c.decisions)
			if len(problems) != 1 {
				t.Fatalf("Recur found %d problems, want 1:\n%s", len(problems), problemText(problems))
			}
		})
	}
}

func TestRecurAcceptsAClassNameAtAWordEdgeOfAHeading(t *testing.T) {
	l := threeOf("register")

	cases := []struct {
		name      string
		decisions string
	}{
		{"in the middle", "# Decisions\n\n## D5 — the register class tripped its threshold\n"},
		{"at the end", "# Decisions\n\n## D5 — the class ruled on here is register\n"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, problems := Recur(l, c.decisions)
			if len(problems) > 0 {
				t.Errorf("Recur found problems though a decision is named from the class:\n%s",
					problemText(problems))
			}
		})
	}
}

// Only a decision's own heading answers a class. The body of the decisions
// ledger will not do: D10 lists all nine class names there to define the
// vocabulary, so a match anywhere in the file would answer every class that
// exists, and this check could never fail on anything.
func TestRecurIgnoresAClassNamedOutsideAHeading(t *testing.T) {
	l := threeOf("register")

	cases := []struct {
		name      string
		decisions string
	}{
		{"in prose", "# Decisions\n\n## D5 — a ruling\n\nThe register class is a real class.\n"},
		{"in a vocabulary list", "# Decisions\n\n## D5 — a ruling\n\n- green-but-wrong\n- register\n- other\n"},
		{"in a heading of the file itself", "# Decisions and the register class\n"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, problems := Recur(l, c.decisions)
			if len(problems) != 1 {
				t.Fatalf("Recur found %d problems, want 1:\n%s", len(problems), problemText(problems))
			}
		})
	}
}

func TestRecurRefusesALedgerWithNoEntries(t *testing.T) {
	_, problems := Recur(Parse("# Findings\n\nNothing here yet.\n"), "# Decisions\n")
	if len(problems) != 1 {
		t.Fatalf("Recur found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
	if problems[0].Where != "" {
		t.Errorf("the problem names %q, want it to be about the whole file", problems[0].Where)
	}
}

// Counting an unknown class rather than dropping it keeps the counter honest
// about what the ledger says. Check refuses the class separately.
func TestCountIncludesAnUnknownClass(t *testing.T) {
	l := threeOf("flaky-test")

	counts, problems := Recur(l, "# Decisions\n\nNothing here.\n")
	if len(counts) != 1 || counts[0].Class != "flaky-test" || counts[0].Count != 3 {
		t.Fatalf("Count returned %+v, want flaky-test at 3", counts)
	}
	if len(problems) != 1 {
		t.Errorf("Recur found %d problems, want 1:\n%s", len(problems), problemText(problems))
	}
}

// An entry with no Class line is counted under no class at all. Check names
// it; the counter must not invent a class for it.
func TestCountSkipsAnEntryWithNoClass(t *testing.T) {
	l := Parse(ledger(
		entry("F1", "One", "Caught by: driver — d", "Class: register"),
		entry("F2", "Two", "Caught by: driver — d"),
	))

	counts := Count(l)
	if len(counts) != 1 || counts[0].Class != "register" || counts[0].Count != 1 {
		t.Fatalf("Count returned %+v, want register at 1", counts)
	}
}

func TestLedgerPathsSitUnderTheRepoRoot(t *testing.T) {
	path, err := LedgerPath(".")
	if err != nil {
		t.Fatalf("LedgerPath returned an error: %v", err)
	}
	if want := filepath.Join("docs", "findings.md"); !strings.HasSuffix(path, want) {
		t.Errorf("LedgerPath is %q, want it to end in %q", path, want)
	}

	decisions, err := DecisionsPath(".")
	if err != nil {
		t.Fatalf("DecisionsPath returned an error: %v", err)
	}
	if want := filepath.Join("docs", "decisions.md"); !strings.HasSuffix(decisions, want) {
		t.Errorf("DecisionsPath is %q, want it to end in %q", decisions, want)
	}
}

// The package's own directory is not the repo root, so this test also proves
// the path is found from a directory below the root.
func TestLedgerPathWorksFromASubdirectory(t *testing.T) {
	path, err := LedgerPath(".")
	if err != nil {
		t.Fatalf("LedgerPath returned an error: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("LedgerPath returned %q, which does not exist: %v", path, err)
	}
}

// The real ledger, checked by the real check. This is the test the backfill
// exists to turn green.
func TestCheckPassesOnTheRealLedger(t *testing.T) {
	path, err := LedgerPath(".")
	if err != nil {
		t.Fatalf("LedgerPath returned an error: %v", err)
	}

	l, err := ParseFile(path)
	if err != nil {
		t.Fatalf("ParseFile returned an error: %v", err)
	}
	if len(l.Entries) == 0 {
		t.Fatalf("ParseFile found no entries in %s", path)
	}

	if problems := Check(l); len(problems) > 0 {
		t.Errorf("%s has %d problems:\n%s", path, len(problems), problemText(problems))
	}
}

func TestRecurPassesOnTheRealLedger(t *testing.T) {
	ledgerPath, err := LedgerPath(".")
	if err != nil {
		t.Fatalf("LedgerPath returned an error: %v", err)
	}
	decisionsPath, err := DecisionsPath(".")
	if err != nil {
		t.Fatalf("DecisionsPath returned an error: %v", err)
	}

	l, err := ParseFile(ledgerPath)
	if err != nil {
		t.Fatalf("ParseFile returned an error: %v", err)
	}
	decisions, err := os.ReadFile(decisionsPath)
	if err != nil {
		t.Fatalf("could not read %s: %v", decisionsPath, err)
	}

	counts, problems := Recur(l, string(decisions))
	if len(counts) == 0 {
		t.Fatalf("Recur counted no classes in %s", ledgerPath)
	}
	if len(problems) > 0 {
		t.Errorf("%s has %d classes over the threshold with no decision:\n%s",
			ledgerPath, len(problems), problemText(problems))
	}
}

// The two classes the ledger's own history put over the threshold, pinned so
// a later edit cannot quietly drop one out of the counts.
// The ledger is append-only, so its counts grow. This test asserts floors and
// the invariant — a class over the threshold has a decision heading answering
// it — never exact counts. Exact counts pinned a moving value once: F16.
func TestRealLedgerHoldsTheAnsweredClasses(t *testing.T) {
	path, err := LedgerPath(".")
	if err != nil {
		t.Fatalf("LedgerPath returned an error: %v", err)
	}
	l, err := ParseFile(path)
	if err != nil {
		t.Fatalf("ParseFile returned an error: %v", err)
	}

	floors := map[string]int{"green-but-wrong": 6, "unrun-proof": 5, "coverage-gap": 3}
	got := map[string]int{}
	for _, c := range Count(l) {
		got[c.Class] = c.Count
	}

	for class, floor := range floors {
		if got[class] < floor {
			t.Errorf("%s holds %d findings of class %s, want at least %d — entries do not leave an append-only ledger", path, got[class], class, floor)
		}
	}
}
