package board

import (
	"bytes"
	"fmt"
	"strings"
	"text/tabwriter"
	"time"
)

// maxLineBytes bounds one line of the render.
//
// D38 ruling 2 asks that every printed line be bound, and every value on one
// comes off a plan file, a commit trailer or a test name. Each is cut to
// MaxValueBytes before it is printed, and every list of them is cut to three
// entries and a count, so the arithmetic below is over fixed words and counts
// no wider than an int prints.
//
// Four lines are candidates for the widest, and the multi-suite line wins:
//
//   - the multi-suite line: a count and its noun at 30 bytes, 34 fixed words,
//     then three names at 64 with two separators and " and N more" at 29 —
//     289 bytes.
//   - a table row: three cut values at 64, four words from this package's own
//     closed vocabularies at 6, 8, 9 and 15, and the padding between seven
//     columns — 242 bytes.
//   - a note: its label at 19, a value and a commit at 64 each, the longest
//     reason this package writes at 94 — the widest reason carries the widest
//     rune escape, and %q spends 12 bytes on a non-BMP rune — and three
//     column gaps — 247 bytes.
//   - the git stamp: two counts and their nouns, the fixed words, the commit at
//     64 and the shallow note — 181 bytes.
//
// So 400 leaves 111 bytes over the widest of them. The searched test below is
// what holds this arithmetic honest: it walks the lengths, the counts and the
// kinds together rather than feeding a maximum into one field (D52 ruling 4).
const maxLineBytes = 400

// loudHeading introduces the block naming the trailers the board did not read.
// It is a sentence, not a column header, so nobody mistakes what follows for
// more of the table.
const loudHeading = "what a person has to look at:"

// Render draws one board.
//
// It is stamped with the run it came from (R8): when the run happened, what it
// cost, how many results it read, and the commit its landed set was read at.
// That is what a reader needs to ask whether this board is still the truth.
func Render(b Board) string {
	var buf bytes.Buffer

	fmt.Fprintf(&buf, "board: %s on %s, derived from the plan, from git, and from the test run\n",
		counted(len(b.Rows), "proof", "proofs"), counted(b.Milestones, "milestone", "milestones"))
	fmt.Fprintf(&buf, "git:   %s, read from %s trailers on %s%s\n",
		counted(len(b.Landed), "slice landed", "slices landed"), TrailerKey,
		counted(b.Commits, "commit", "commits"), where(b))
	fmt.Fprintf(&buf, "run:   %s in %s at %s\n",
		counted(b.Run.Tests, "test", "tests"), took(b.Run.Took), when(b.Run.At))

	if len(b.Rows) == 0 {
		buf.WriteString("\nthis plan names no proof, so there is no board to draw\n")

		return buf.String() + notes(b)
	}

	buf.WriteString("\n")
	buf.WriteString(table(b))
	fmt.Fprintf(&buf, "\n%s: %d on plan, %d ahead of plan, %d behind\n",
		counted(len(b.Rows), "proof", "proofs"),
		len(b.OnPlan()), len(b.Ahead()), len(b.Behind()))

	// One test name answers for one proof, so a name two suites both reported
	// is a thing the reader has to see — and a clean board is when a folded
	// double answer misleads most (F76).
	if len(b.Run.Twice) > 0 {
		fmt.Fprintf(&buf, "%s reported by more than one suite: %s\n",
			counted(len(b.Run.Twice), "test was", "tests were"), listed(b.Run.Twice))
	}

	return buf.String() + notes(b)
}

// table draws one line per proof: where it sits, whether its own slice landed,
// what its plan position expects, what the run said, and how the two sit
// together.
func table(b Board) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	fmt.Fprintln(w, "MILESTONE\tSLICE\tLANDED\tPROOF\tEXPECTED\tACTUAL\tFLAG")
	for _, row := range b.Rows {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			row.Milestone, row.Slice, yesNo(row.Landed), row.Proof,
			row.Expected, row.Actual, row.Flag)
	}
	w.Flush()

	return buf.String()
}

// notes draws the block naming every trailer the board did not read, and every
// trailer that misstates landed-ness.
//
// They are named rather than left in a count. A trailer nobody can see is how a
// typo comes to un-land a slice quietly.
func notes(b Board) string {
	if len(b.Wrong) == 0 && len(b.Unread) == 0 {
		return ""
	}

	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	for _, kind := range []struct {
		what  string
		notes []Note
	}{
		{"misstated", b.Wrong},
		{"unread", b.Unread},
	} {
		for _, note := range kind.notes {
			fmt.Fprintf(w, "  %s trailer\t%s\t%s\t%s\n", kind.what, note.Value, note.Commit, note.Why)
		}
	}
	w.Flush()

	return "\n" + loudHeading + "\n" + buf.String()
}

// where says what the landed set was read at, and whether the history behind it
// was all there.
func where(b Board) string {
	var said string
	if b.Head != "" {
		said = " at " + say(b.Head)
	}
	if b.Shallow {
		said += ", a shallow history"
	}

	return said
}

// when renders the moment a run started, in UTC, so two boards from two
// machines can be read against each other.
func when(at time.Time) string {
	if at.IsZero() {
		return "a time nobody recorded"
	}

	return at.UTC().Format(time.RFC3339)
}

// took renders how long a run cost, to a tenth of a second.
func took(d time.Duration) string {
	return d.Round(100 * time.Millisecond).String()
}

// yesNo renders whether a slice has landed.
func yesNo(landed bool) string {
	if landed {
		return "yes"
	}

	return "no"
}

// listed renders the first few of a list and says how many it left out, so one
// long list cannot turn a summary line into a paragraph.
func listed(all []string) string {
	const most = 3

	said := all
	if len(all) > most {
		said = all[:most]
	}

	line := strings.Join(sayEach(said), ", ")
	if left := len(all) - len(said); left > 0 {
		line += fmt.Sprintf(" and %d more", left)
	}

	return line
}

// sayEach makes every entry of a list safe and short enough to print.
func sayEach(all []string) []string {
	out := make([]string, 0, len(all))
	for _, one := range all {
		out = append(out, say(one))
	}

	return out
}

// counted renders a count with its noun, singular for one. It is a rendering
// helper and not a rule: nothing is decided here.
func counted(n int, one, many string) string {
	if n == 1 {
		return "1 " + one
	}

	return fmt.Sprintf("%d %s", n, many)
}
