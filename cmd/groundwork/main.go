// Command groundwork is the GroundWork command line tool.
//
// It runs one verb per invocation: groundwork <verb> [flags]. It exits 0 when
// the work is done, 1 when the work failed, and 2 when the command line was
// wrong or the host-usage sidecar is missing.
//
// main stays thin. The work lives in the internal packages.
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
	"text/tabwriter"

	"github.com/ryannel/groundwork/internal/journal"
)

// The exit codes the tool promises.
const (
	exitOK     = 0
	exitFailed = 1
	exitUsage  = 2

	// exitSidecarMissing shares exitUsage's number. A missing host-usage
	// sidecar is not a command-line mistake, but the tool's exit-code
	// promise already spends 2 on "something is missing before the work
	// could even start", and a missing sidecar is exactly that.
	exitSidecarMissing = 2
)

const usage = `usage: groundwork <verb> [flags]

verbs:
  journal    record an event in the journal
  findings   check the findings ledger
`

const findingsUsage = `usage: groundwork findings <subcommand>

subcommands:
  check   check that every finding records what caught it, and what class it is
  recur   count the findings of each class, and check that a class at or over
          the threshold has a decision named from it
`

const journalUsage = `usage: groundwork journal <subcommand> [flags]

subcommands:
  dispatch        record one dispatch of an agent
  dial            record a move of the autonomy dial
  seal            record a seal granted or revoked
  spend           report token and time spend, grouped by role, tier or session
  merge           merge another journal commit into this repo's journal
  verify-tokens   cross-check a session's dispatch tokens against the host's own report
`

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run does the work of main and returns the exit code.
// It takes its writers, so a test can call it directly.
func run(args []string, out, errOut io.Writer) int {
	if len(args) == 0 {
		fmt.Fprint(errOut, usage)
		return exitUsage
	}

	switch args[0] {
	case "journal":
		return runJournal(args[1:], out, errOut)
	case "findings":
		return runFindings(args[1:], out, errOut)
	default:
		fmt.Fprintf(errOut, "groundwork: unknown verb %q\n\n", args[0])
		fmt.Fprint(errOut, usage)
		return exitUsage
	}
}

// runJournal handles the journal verb.
func runJournal(args []string, out, errOut io.Writer) int {
	if len(args) == 0 {
		fmt.Fprint(errOut, journalUsage)
		return exitUsage
	}

	switch args[0] {
	case "dispatch":
		return runJournalDispatch(args[1:], out, errOut)
	case "dial":
		return runJournalDial(args[1:], out, errOut)
	case "seal":
		return runJournalSeal(args[1:], out, errOut)
	case "spend":
		return runJournalSpend(args[1:], out, errOut)
	case "merge":
		return runJournalMerge(args[1:], out, errOut)
	case "verify-tokens":
		return runJournalVerifyTokens(args[1:], out, errOut)
	default:
		fmt.Fprintf(errOut, "groundwork journal: unknown subcommand %q\n\n", args[0])
		fmt.Fprint(errOut, journalUsage)
		return exitUsage
	}
}

// notGiven is the default for the number flags. Every real count is zero or
// more, so this value marks a flag the caller left out.
const notGiven = -1

// given pairs a flag's name with the value the caller gave it.
type given struct {
	name  string
	value string
}

// emptyFlags names the flags that were left without a value.
func emptyFlags(flags ...given) []string {
	var wrong []string

	for _, f := range flags {
		if f.value == "" {
			wrong = append(wrong, f.name+" needs a value")
		}
	}

	return wrong
}

// spareArgument reports a leftover argument. Only merge takes one, and it
// checks its own.
func spareArgument(errOut io.Writer, flags *flag.FlagSet, name string) bool {
	if flags.NArg() == 0 {
		return false
	}

	fmt.Fprintf(errOut, "%s: unexpected argument %q\n", name, flags.Arg(0))
	flags.Usage()

	return true
}

// sayWrong prints what the command line got wrong, with the usage after it.
func sayWrong(errOut io.Writer, flags *flag.FlagSet, name string, wrong []string) int {
	for _, problem := range wrong {
		fmt.Fprintln(errOut, name+":", problem)
	}
	flags.Usage()

	return exitUsage
}

// report prints the result of one journal write and returns the exit code.
func report(out, errOut io.Writer, name, path string, err error) int {
	if errors.Is(err, journal.ErrNotARepo) {
		fmt.Fprintln(errOut, name+": not in a git repository")
		return exitFailed
	}
	if err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	fmt.Fprintln(out, path)

	return exitOK
}

// runJournalDispatch records one dispatch event.
func runJournalDispatch(args []string, out, errOut io.Writer) int {
	const name = "groundwork journal dispatch"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)

	role := flags.String("role", "", "who was dispatched: "+strings.Join(journal.Roles(), ", "))
	tier := flags.String("tier", "", "which model tier ran it: "+strings.Join(journal.Tiers(), ", "))
	tokensIn := flags.Int("tokens-in", notGiven, "input tokens")
	tokensOut := flags.Int("tokens-out", notGiven, "output tokens")
	durationMS := flags.Int("duration-ms", notGiven, "how long it took, in milliseconds")
	outcome := flags.String("outcome", "", "how it ended")
	tokensSource := flags.String("tokens-source", "unset", "where the token counts came from")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	wrong := emptyFlags(
		given{"--role", *role},
		given{"--tier", *tier},
		given{"--outcome", *outcome},
		given{"--tokens-source", *tokensSource},
	)
	for _, f := range []struct {
		name  string
		value int
	}{
		{"--tokens-in", *tokensIn},
		{"--tokens-out", *tokensOut},
		{"--duration-ms", *durationMS},
	} {
		if f.value < 0 {
			wrong = append(wrong, f.name+" needs a number of zero or more")
		}
	}
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	path, err := journal.WriteDispatch(".", journal.Dispatch{
		Role:         *role,
		Tier:         *tier,
		TokensIn:     *tokensIn,
		TokensOut:    *tokensOut,
		TokensSource: *tokensSource,
		DurationMS:   *durationMS,
		Outcome:      *outcome,
	})

	return report(out, errOut, name, path, err)
}

// runJournalDial records one move of the autonomy dial.
//
// There is no --from flag. The rung the scope is leaving is read from the
// journal, so the record cannot disagree with itself.
func runJournalDial(args []string, out, errOut io.Writer) int {
	const name = "groundwork journal dial"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)

	to := flags.String("to", "", "which rung to run up to: "+strings.Join(journal.Rungs(), ", "))
	scope := flags.String("scope", "", "what the dial applies to")
	reason := flags.String("reason", "", "why it moved")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	wrong := emptyFlags(
		given{"--to", *to},
		given{"--scope", *scope},
		given{"--reason", *reason},
	)
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	path, err := journal.WriteDial(".", journal.Dial{
		To:     *to,
		Scope:  *scope,
		Reason: *reason,
	})

	return report(out, errOut, name, path, err)
}

// runJournalSeal records one seal granted or revoked.
//
// There is no --target flag. The commit is read from the tag, so the record
// cannot name a commit the tag does not hold.
func runJournalSeal(args []string, out, errOut io.Writer) int {
	const name = "groundwork journal seal"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)

	kind := flags.String("kind", "", "what kind of seal it is")
	tag := flags.String("tag", "", "the tag that carries the seal")
	action := flags.String("action", "granted",
		"what happened to it: "+strings.Join(journal.SealActions(), " or "))

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	wrong := emptyFlags(
		given{"--kind", *kind},
		given{"--tag", *tag},
		given{"--action", *action},
	)
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	path, err := journal.WriteSeal(".", journal.Seal{
		Kind:   *kind,
		Tag:    *tag,
		Action: *action,
	})

	return report(out, errOut, name, path, err)
}

// runJournalSpend reports token and time spend, grouped by the chosen key.
// It reads the journal ref. It never writes to it.
func runJournalSpend(args []string, out, errOut io.Writer) int {
	const name = "groundwork journal spend"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)

	by := flags.String("by", "", "how to group the spend: "+strings.Join(journal.SpendKeys(), ", "))

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	var wrong []string
	if !slices.Contains(journal.SpendKeys(), *by) {
		wrong = append(wrong, fmt.Sprintf("--by must be one of: %s", strings.Join(journal.SpendKeys(), ", ")))
	}
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	rows, hasRef, err := journal.Spend(".", *by)
	if err != nil {
		if errors.Is(err, journal.ErrNotARepo) {
			fmt.Fprintln(errOut, name+": not in a git repository")
			return exitFailed
		}
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	// Two different, both honest, kinds of nothing. A repo that never wrote
	// to the journal has spent nothing. A journal that only holds dial or
	// seal lines has dispatches to report, and there are none — that is not
	// the same claim, so it gets its own words.
	if !hasRef {
		fmt.Fprintln(out, "the journal is empty")
		return exitOK
	}
	if len(rows) == 0 {
		fmt.Fprintln(out, "the journal holds no dispatch lines")
		return exitOK
	}

	fmt.Fprint(out, spendTable(*by, rows))

	return exitOK
}

// spendTotalLabel marks the summary row spendTable appends. Parentheses fall
// outside the session charset checkSession enforces, so a session actually
// named "TOTAL" cannot be mistaken for the row spendTable computes.
const spendTotalLabel = "(total)"

// spendTable renders spend rows as a plain aligned text table: a header
// row, one row per group in the order given, and a total row. by names the
// group column, and is shown as its header.
//
// Rows come in already sorted; spendTable only renders and sums them.
func spendTable(by string, rows []journal.SpendRow) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	fmt.Fprintf(w, "%s\tDISPATCHES\tTOKENS_IN\tTOKENS_OUT\tTOKENS_TOTAL\tDURATION_MS\n", strings.ToUpper(by))

	var dispatches, tokensIn, tokensOut, tokensTotal, durationMS int64
	for _, r := range rows {
		fmt.Fprintf(w, "%s\t%d\t%d\t%d\t%d\t%d\n",
			r.Key, r.Dispatches, r.TokensIn, r.TokensOut, r.TokensTotal, r.DurationMS)

		dispatches += r.Dispatches
		tokensIn += r.TokensIn
		tokensOut += r.TokensOut
		tokensTotal += r.TokensTotal
		durationMS += r.DurationMS
	}

	fmt.Fprintf(w, "%s\t%d\t%d\t%d\t%d\t%d\n", spendTotalLabel, dispatches, tokensIn, tokensOut, tokensTotal, durationMS)

	w.Flush()

	return buf.String()
}

// runJournalMerge merges another journal commit into this repo's journal.
//
// It takes one argument rather than a flag, because the thing being merged is
// the whole point of the verb. The usual argument is a ref fetched from
// another clone.
func runJournalMerge(args []string, out, errOut io.Writer) int {
	const name = "groundwork journal merge"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() {
		fmt.Fprintf(errOut, "usage: %s <commit-ish>\n", name)
	}

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if flags.NArg() != 1 {
		return sayWrong(errOut, flags, name, []string{"merge takes one commit, and nothing else"})
	}

	res, err := journal.Merge(".", flags.Arg(0))
	if err != nil {
		if errors.Is(err, journal.ErrNotARepo) {
			fmt.Fprintln(errOut, name+": not in a git repository")
			return exitFailed
		}
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	fmt.Fprintln(out, mergeSentence(res))

	return exitOK
}

// mergeSentence says what a merge did, with the counts that let a reader check
// it against the ref.
func mergeSentence(res journal.MergeResult) string {
	switch res.Outcome {
	case journal.AlreadyMerged:
		return "already merged: the journal already holds that commit"
	case journal.FastForwarded:
		return fmt.Sprintf("fast-forwarded: %s in total", countedLines(res.Total))
	case journal.Merged:
		return fmt.Sprintf("merged: %s from this journal, %s from the other, %s in total",
			countedLines(res.Local), countedLines(res.Other), countedLines(res.Total))
	default:
		// Every outcome the journal can report is named above. A new one
		// means this switch was not updated with it, and printing a vague
		// sentence would hide that. So it stops here instead.
		panic(fmt.Sprintf("groundwork: the merge reported the outcome %q, which this build cannot say", res.Outcome))
	}
}

// countedLines renders a count of journal lines, singular for one.
func countedLines(n int) string {
	if n == 1 {
		return "1 line"
	}

	return fmt.Sprintf("%d lines", n)
}

// runJournalVerifyTokens cross-checks one session's dispatch tokens against
// the host's own out-of-band report, read from the uncommitted sidecar at
// .groundwork/host-usage/<session>.json.
//
// It never writes to the journal. A mismatch, an ambiguous seq, or a
// dispatch the host claims but the journal never recorded all fail the run.
// A missing sidecar fails it too, at exitSidecarMissing: a missing sidecar
// must never pass as if there were nothing to check.
func runJournalVerifyTokens(args []string, out, errOut io.Writer) int {
	const name = "groundwork journal verify-tokens"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)

	session := flags.String("session", "", "the session id to check")
	tolerance := flags.Int64("tolerance", 0, "how many tokens a figure may differ by and still count as ok")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	var wrong []string
	if *session == "" {
		wrong = append(wrong, "--session needs a value")
	}
	if *tolerance < 0 {
		wrong = append(wrong, "--tolerance needs a number of zero or more")
	}
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	result, err := journal.VerifyTokens(".", *session, *tolerance)
	if err != nil {
		if errors.Is(err, journal.ErrSidecarMissing) {
			fmt.Fprintln(errOut, name+":", err)
			return exitSidecarMissing
		}
		if errors.Is(err, journal.ErrNotARepo) {
			fmt.Fprintln(errOut, name+": not in a git repository")
			return exitFailed
		}
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	// Ambiguous gets its own bucket, apart from mismatched: an ambiguous seq
	// means the journal disagrees with itself, not that it disagrees with
	// the host. Folding it into mismatched would blur two different kinds
	// of wrong into one count.
	ok, mismatched, ambiguous, neverJournaled := 0, 0, 0, 0
	for _, row := range result.Rows {
		fmt.Fprintln(out, verifyLine(row))

		switch row.Status {
		case journal.VerifyOK:
			ok++
		case journal.VerifyNeverJournaled:
			neverJournaled++
		case journal.VerifyAmbiguous:
			ambiguous++
		default:
			mismatched++
		}
	}
	fmt.Fprintf(out, "checked %d, ok %d, mismatched %d, ambiguous %d, never-journaled %d, unchecked %d\n",
		len(result.Rows), ok, mismatched, ambiguous, neverJournaled, result.Unchecked)

	if mismatched > 0 || ambiguous > 0 || neverJournaled > 0 {
		return exitFailed
	}

	return exitOK
}

// verifyLine renders one seq's cross-check as one line of output: its seq,
// the journal's own figure or figures (or "-" when the journal has no line
// at that seq at all), the host's figure (or "-" when the sidecar never
// claimed this seq — an unclaimed collision still gets a row, but has no
// host figure to show), and the status. An ambiguous seq prints every
// figure the journal holds for it, comma separated, rather than picking one
// to show.
func verifyLine(row journal.VerifyRow) string {
	journalFigure := "-"
	if len(row.JournalTokens) > 0 {
		figures := make([]string, len(row.JournalTokens))
		for i, t := range row.JournalTokens {
			figures[i] = strconv.FormatInt(t, 10)
		}
		journalFigure = strings.Join(figures, ",")
	}

	hostFigure := "-"
	if row.HostClaimed {
		hostFigure = strconv.FormatInt(row.HostTokens, 10)
	}

	return fmt.Sprintf("seq=%d journal=%s host=%s %s",
		row.Seq, journalFigure, hostFigure, row.Status)
}
