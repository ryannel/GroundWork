// Package findings reads the findings ledger at docs/findings.md and checks
// what it says about each defect.
//
// Two rules are checked here. Every finding records what caught it: a catcher
// from a closed list, plus a free detail line naming the specific review or
// check (D9). Every finding also carries at least one defect class from a
// closed list, and the class `other` carries a one-line reason (D10). A class
// that reaches the recurrence threshold has to be answered by a decision
// named from it (D18).
//
// This package only reads. It never writes to either ledger: those files are
// written by hand, and are append-only.
package findings

import (
	"cmp"
	"fmt"
	"os"
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Threshold is how many findings of one class force an upstream change. D10
// set it at three. D18 ruled that this first version counts across the whole
// ledger, and demands a decision named from the class.
const Threshold = 3

// catchers is the closed vocabulary for what caught a finding, from D9.
var catchers = []string{
	"blind-review", "battery", "ci", "driver", "worker", "owner-in-review", "owner-in-use",
}

// classes is the closed vocabulary for a finding's defect class, from D10.
// D21 added host-limit: a defect caused by a host capability gap, worked
// around rather than fixed.
var classes = []string{
	"green-but-wrong",
	"parallel-definition",
	"unrun-proof",
	"coverage-gap",
	"front-door-hollow",
	"record-not-written",
	"friction-waived",
	"register",
	"host-limit",
	"other",
}

// Classes returns the defect classes a finding may carry.
func Classes() []string {
	return slices.Clone(classes)
}

// otherClass is the one class that needs a reason of its own.
const otherClass = "other"

// caughtByLabel and classLabel start the lines that carry a finding's
// attribution and its classes.
const (
	caughtByLabel = "Caught by:"
	classLabel    = "Class:"
)

// emDash separates the fields of an entry heading: a space, an em dash, a
// space.
const emDash = " — "

// labelDash is what separates a label's vocabulary word from the free text
// after it. It stops at the em dash rather than at the space after it, so a
// label that ends in a bare dash — "Caught by: driver —" — reads as a driver
// with no detail, which Check then names, instead of as a catcher nobody has
// ever heard of.
const labelDash = " —"

// dashVariants are the dashes a writer reaches for when they mean the em
// dash. A label separated by one of these is named for what it is, rather
// than being reported as a catcher nobody has heard of or a detail that is
// not there.
var dashVariants = []string{" –", " -"}

// headingPattern matches a well-formed entry heading: exactly two hashes, one
// space, then F and a number.
var headingPattern = regexp.MustCompile(`^## (F[0-9]+)(\s|$)`)

// findingBodyPattern matches the text of a heading that means to be a
// finding, whatever level it was written at and however it spaced its hashes.
var findingBodyPattern = regexp.MustCompile(`^F[0-9]+(\s|$)`)

// fenceMark opens and closes a fenced code block.
const fenceMark = "```"

// ClassLine is one Class label an entry carries. An entry may carry more than
// one: a finding that holds two kinds of defect records one line for each
// (D18, as amended).
type ClassLine struct {
	Class  string
	Reason string

	// Dash holds the wrong dash the line used where an em dash belongs, and
	// is empty when the line used the right one, or no dash at all.
	Dash string

	// Line is the 1-based line this label sits on.
	Line int
}

// Entry is one finding, as the ledger records it.
//
// A field the ledger did not give is empty. CaughtByLines says how many
// attribution lines the entry actually held, so a caller can tell an entry
// that carries one from an entry that carries two. When an entry holds more
// than one, the fields hold the first: a later line never silently replaces
// what the entry said first.
type Entry struct {
	ID    string
	Title string

	// Line is the 1-based line the entry's heading sits on.
	Line int

	Catcher string
	Detail  string

	// CatcherDash holds the wrong dash the Caught by line used where an em
	// dash belongs, and is empty when it used the right one, or none.
	CatcherDash string

	// CaughtByLine is the 1-based line the first Caught by label sits on.
	CaughtByLine int

	CaughtByLines int

	Classes []ClassLine
}

// BadHeading is a heading line that means to be an entry heading and is not
// one: written at the wrong level, or with no space after its hashes.
//
// These are collected rather than ignored. A heading like "### F12 — ..."
// silently drops a whole finding out of every count, which is the quietest
// way this check could ever be wrong.
type BadHeading struct {
	Line int
	Text string
}

// Ledger is a parsed findings ledger.
type Ledger struct {
	Entries     []Entry
	BadHeadings []BadHeading
}

// Problem is one thing wrong with the ledger.
//
// Where names what the problem is about: an entry's id, a class name, or the
// empty string for a problem with the file as a whole. Line is the 1-based
// line to point a reader at, or zero when no one line is to blame. The caller
// renders both, so the same problem can be printed against whatever path it
// read.
type Problem struct {
	Where string
	Line  int
	Text  string
}

// ParseFile reads a ledger from disk and parses it.
func ParseFile(path string) (Ledger, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Ledger{}, fmt.Errorf("could not read %s: %w", path, err)
	}

	return Parse(string(raw)), nil
}

// Parse reads a findings ledger.
//
// An entry starts at a heading of the form "## F<n> — <date> — <title>" and
// runs to the next heading of any level. A label counts when it starts its
// own line, so the words "Caught by:" inside a sentence stay prose. Labels
// may sit anywhere inside their entry: F1 in the real ledger carries a
// Resolved line, and its labels come after it.
//
// Fenced code blocks are skipped whole. Nothing inside a fence opens an
// entry, closes one, or counts as a label — a ledger that quotes an entry to
// explain the format must not thereby record a finding.
//
// A heading that means to be an entry heading but is not one comes back in
// BadHeadings rather than being passed over, so a finding written at the
// wrong level cannot drop out of the counts unnoticed.
//
// A ledger written with CRLF endings reads the same as one written with bare
// newlines: every field is trimmed as it is read, and that takes the carriage
// return with it. TestParseReadsACRLFLedger pins that.
//
// Parse never fails. A ledger that says nothing, or says it wrongly, comes
// back as entries that Check then has something to say about. Two things it
// tolerates on purpose, because neither can hide a missing label: a heading
// with fewer fields than usual leaves the title empty, and text before the
// first entry heading belongs to no entry.
func Parse(text string) Ledger {
	var l Ledger
	current := -1
	inFence := false

	for i, line := range strings.Split(text, "\n") {
		number := i + 1

		if strings.HasPrefix(strings.TrimLeft(line, " \t"), fenceMark) {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}

		if rest, isHeading := afterHashes(line); isHeading {
			// Every heading closes the entry above it, so labels under a
			// heading are never read as the previous entry's.
			current = -1

			if id, title, ok := heading(line); ok {
				l.Entries = append(l.Entries, Entry{ID: id, Title: title, Line: number})
				current = len(l.Entries) - 1

				continue
			}

			if findingBodyPattern.MatchString(strings.TrimLeft(rest, " \t")) {
				l.BadHeadings = append(l.BadHeadings, BadHeading{Line: number, Text: line})
			}

			continue
		}

		if current < 0 {
			continue
		}

		if value, ok := label(line, caughtByLabel); ok {
			e := &l.Entries[current]
			e.CaughtByLines++
			if e.CaughtByLines == 1 {
				e.CaughtByLine = number
				e.Catcher, e.Detail, e.CatcherDash = splitAtDash(value)
			}

			continue
		}

		if value, ok := label(line, classLabel); ok {
			class, reason, dash := splitAtDash(value)
			l.Entries[current].Classes = append(l.Entries[current].Classes, ClassLine{
				Class:  class,
				Reason: reason,
				Dash:   dash,
				Line:   number,
			})
		}
	}

	return l
}

// afterHashes returns what a line holds after its opening run of hashes, and
// whether the line opened with one at all.
func afterHashes(line string) (string, bool) {
	rest := strings.TrimLeft(line, "#")
	if len(rest) == len(line) {
		return "", false
	}

	return rest, true
}

// heading reads a well-formed entry heading and returns its id and title.
//
// The heading is "## F<n> — <date> — <title>". The title is everything after
// the second em dash, so a title holding em dashes of its own arrives whole.
func heading(line string) (id, title string, ok bool) {
	match := headingPattern.FindStringSubmatch(line)
	if match == nil {
		return "", "", false
	}

	id = match[1]

	fields := strings.SplitN(line, emDash, 3)
	if len(fields) == 3 {
		title = strings.TrimSpace(fields[2])
	}

	return id, title, true
}

// label reads one labelled line and returns the text after the label.
//
// The label has to start the line, give or take leading whitespace. That is
// what keeps the words "Caught by:" in the middle of a sentence from being
// read as an attribution the entry never made.
func label(line, name string) (string, bool) {
	trimmed := strings.TrimLeft(line, " \t")
	if !strings.HasPrefix(trimmed, name) {
		return "", false
	}

	return strings.TrimSpace(trimmed[len(name):]), true
}

// splitAtDash splits a label's value at its first em dash: the vocabulary
// word first, the free text after it.
//
// The split is at the first dash only, so free text may hold em dashes of its
// own. A value with no em dash, and a value whose em dash has nothing after
// it, both come back with empty free text, which Check then names.
//
// dash comes back holding the wrong dash a line used where an em dash
// belongs. An en dash or a hyphen is a typing slip, not a missing detail, and
// saying which it was costs one field and saves a reader the hunt.
func splitAtDash(value string) (head, tail, dash string) {
	if before, after, found := strings.Cut(value, labelDash); found {
		return strings.TrimSpace(before), strings.TrimSpace(after), ""
	}

	for _, variant := range dashVariants {
		if before, after, found := strings.Cut(value, variant); found {
			return strings.TrimSpace(before), strings.TrimSpace(after), strings.TrimSpace(variant)
		}
	}

	return strings.TrimSpace(value), "", ""
}

// Check returns everything wrong with a parsed ledger, in the order the file
// holds it. An empty result means every finding records what caught it, and
// what classes of defect it holds.
//
// A ledger that parsed to no entries at all is refused, not passed. An empty
// result is far more likely to mean the headings stopped matching than to
// mean a project has found no defects, and a check that passed on nothing
// would hide exactly that.
func Check(l Ledger) []Problem {
	var problems []Problem

	for _, b := range l.BadHeadings {
		problems = append(problems, Problem{
			Line: b.Line,
			Text: fmt.Sprintf("%q means to be an entry heading and is not one. An entry heading is two hashes, one space, then F and a number",
				b.Text),
		})
	}

	if len(l.Entries) == 0 {
		return append(problems, Problem{
			Text: "holds no findings: either the ledger is empty, or its entry headings no longer parse",
		})
	}

	firstAt := map[string]int{}

	for _, e := range l.Entries {
		add := func(line int, format string, args ...any) {
			problems = append(problems, Problem{Where: e.ID, Line: line, Text: fmt.Sprintf(format, args...)})
		}

		if at, repeated := firstAt[e.ID]; repeated {
			add(e.Line, "repeats the id of the finding at line %d. Every finding has an id of its own", at)
		} else {
			firstAt[e.ID] = e.Line
		}

		checkCaughtBy(e, add)
		checkClasses(e, add)
	}

	slices.SortStableFunc(problems, func(a, b Problem) int { return cmp.Compare(a.Line, b.Line) })

	return problems
}

// checkCaughtBy reports what is wrong with an entry's attribution.
func checkCaughtBy(e Entry, add func(line int, format string, args ...any)) {
	switch {
	case e.CaughtByLines == 0:
		add(e.Line, "has no %s line. Every finding records what caught it", caughtByLabel)
	case e.CaughtByLines > 1:
		add(e.CaughtByLine, "has %d %s lines, and one is all a finding may have", e.CaughtByLines, caughtByLabel)
	default:
		if e.CatcherDash != "" {
			add(e.CaughtByLine, "separates its %s line with %q, where the em dash %q belongs",
				caughtByLabel, e.CatcherDash, "—")
		}
		if !slices.Contains(catchers, e.Catcher) {
			add(e.CaughtByLine, "names the catcher %q, which is not one of: %s",
				e.Catcher, strings.Join(catchers, ", "))
		}
		if e.Detail == "" && e.CatcherDash == "" {
			add(e.CaughtByLine, "has a %s line with no detail after the em dash. The detail names the review or check that caught it",
				caughtByLabel)
		}
	}
}

// checkClasses reports what is wrong with an entry's classes.
//
// An entry may hold more than one class, one line each: a finding that is
// both a wrong result and an unproven claim records both. What it may not do
// is record the same class twice, which says nothing and would count twice if
// the counter let it.
func checkClasses(e Entry, add func(line int, format string, args ...any)) {
	if len(e.Classes) == 0 {
		add(e.Line, "has no %s line", classLabel)
		return
	}

	seen := map[string]bool{}

	for _, c := range e.Classes {
		if seen[c.Class] {
			add(c.Line, "records the class %q twice", c.Class)
			continue
		}
		seen[c.Class] = true

		if c.Dash != "" {
			add(c.Line, "separates its %s line with %q, where the em dash %q belongs", classLabel, c.Dash, "—")
		}
		if !slices.Contains(classes, c.Class) {
			add(c.Line, "names the class %q, which is not one of: %s", c.Class, strings.Join(classes, ", "))
		}
		if c.Class == otherClass && c.Reason == "" {
			add(c.Line, "is class %s with no reason after the em dash. %s carries a one-line reason",
				otherClass, otherClass)
		}
	}
}

// ClassCount is how many findings one class holds.
type ClassCount struct {
	Class string
	Count int
}

// Count returns how many findings each class holds, the largest first, ties
// broken by class name.
//
// One finding counts once per class it holds, however many lines it wrote:
// the pair of a finding and a class is what is counted. An entry with no
// class at all is counted under no class, because Check names that entry and
// inventing a class for it would make the counts disagree with the file. A
// class the vocabulary does not hold is counted as written, so the counts
// stay a report of what the ledger says.
func Count(l Ledger) []ClassCount {
	totals := map[string]int{}

	for _, e := range l.Entries {
		seen := map[string]bool{}
		for _, c := range e.Classes {
			if c.Class == "" || seen[c.Class] {
				continue
			}
			seen[c.Class] = true
			totals[c.Class]++
		}
	}

	counts := make([]ClassCount, 0, len(totals))
	for class, n := range totals {
		counts = append(counts, ClassCount{Class: class, Count: n})
	}

	// The largest count first, ties broken by name, so the same ledger always
	// prints in the same order. cmp.Compare, not subtraction: a subtraction
	// comparator wraps at the extremes.
	slices.SortFunc(counts, func(a, b ClassCount) int {
		if c := cmp.Compare(b.Count, a.Count); c != 0 {
			return c
		}
		return cmp.Compare(a.Class, b.Class)
	})

	return counts
}

// Recur counts the classes in a ledger and reports every class at or over
// the threshold that no decision is named from.
//
// decisions is the whole text of docs/decisions.md. A class is answered when
// a decision's own heading names it; see decidedOn for why the body of that
// file does not count. The counts come back whether or not anything is wrong,
// so a caller can print where every class stands on a pass as well as a
// failure.
func Recur(l Ledger, decisions string) ([]ClassCount, []Problem) {
	counts := Count(l)

	if len(l.Entries) == 0 {
		return counts, []Problem{{
			Text: "holds no findings: either the ledger is empty, or its entry headings no longer parse",
		}}
	}

	var problems []Problem

	for _, c := range counts {
		if c.Count < Threshold {
			continue
		}
		if decidedOn(decisions, c.Class) {
			continue
		}

		problems = append(problems, Problem{
			Where: c.Class,
			Text: fmt.Sprintf(
				"has %d findings, at or over the threshold of %d, and no decision heading is named from it",
				c.Count, Threshold),
		})
	}

	return counts, problems
}

// decidedOn reports whether the decisions ledger holds a decision named from
// a class.
//
// Only a decision's own heading counts. D10 says the upstream change a class
// forces "gets recorded here, named from the class", and the two decisions
// that exist do exactly that: D16 is named from unrun-proof, D18 from
// green-but-wrong. Anywhere in the file will not do, because D10 itself lists
// all nine class names to define the vocabulary. A match against the whole
// file would therefore be satisfied for every class by the definition of the
// vocabulary rather than by any ruling, and this check could never fail on
// anything.
func decidedOn(decisions, class string) bool {
	for _, line := range strings.Split(decisions, "\n") {
		if !strings.HasPrefix(line, "## ") {
			continue
		}
		if names(line, class) {
			return true
		}
	}

	return false
}

// names reports whether text names a class.
//
// The match stops at word edges. Class names like "register" and "other" are
// ordinary English words, and a bare substring match would let any prose at
// all count as a ruling on them. A hyphen counts as part of a word, so
// "register" does not match inside "registers-late".
func names(text, class string) bool {
	for at := 0; ; {
		i := strings.Index(text[at:], class)
		if i < 0 {
			return false
		}

		start := at + i
		end := start + len(class)

		if !wordChar(before(text, start)) && !wordChar(after(text, end)) {
			return true
		}

		at = start + 1
	}
}

// before returns the rune just before position i, or a space at the start of
// the text.
func before(text string, i int) rune {
	r, _ := utf8.DecodeLastRuneInString(text[:i])
	if r == utf8.RuneError {
		return ' '
	}

	return r
}

// after returns the rune at position i, or a space at the end of the text.
func after(text string, i int) rune {
	r, _ := utf8.DecodeRuneInString(text[i:])
	if r == utf8.RuneError {
		return ' '
	}

	return r
}

// wordChar reports whether a rune can sit inside a class name or inside an
// ordinary word. Hyphens and underscores count, because class names hold
// hyphens.
func wordChar(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_'
}
