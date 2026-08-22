package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"text/tabwriter"

	"github.com/ryannel/groundwork/internal/findings"
)

// runFindings handles the findings verb.
func runFindings(args []string, out, errOut io.Writer) int {
	if len(args) == 0 {
		fmt.Fprint(errOut, findingsUsage)
		return exitUsage
	}

	switch args[0] {
	case "check":
		return runFindingsCheck(args[1:], out, errOut)
	case "recur":
		return runFindingsRecur(args[1:], out, errOut)
	default:
		fmt.Fprintf(errOut, "groundwork findings: unknown subcommand %q\n\n", args[0])
		fmt.Fprint(errOut, findingsUsage)
		return exitUsage
	}
}

// findingsFlags builds the flag set for a findings subcommand. Neither
// subcommand takes a flag or an argument: both read the two ledgers, which
// live at fixed paths under the repo root.
func findingsFlags(errOut io.Writer, name string) *flag.FlagSet {
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() {
		fmt.Fprint(errOut, findingsUsage)
	}

	return flags
}

// runFindingsCheck checks that every finding in the ledger records what
// caught it, and what class of defect it is.
//
// It reads docs/findings.md from the repo root, so it says the same thing
// wherever in the repo it runs. It never writes to the ledger.
func runFindingsCheck(args []string, out, errOut io.Writer) int {
	const name = "groundwork findings check"

	flags := findingsFlags(errOut, name)
	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	path, err := findings.LedgerPath(".")
	if err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	ledger, err := findings.ParseFile(path)
	if err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	problems := findings.Check(ledger)
	if len(problems) > 0 {
		for _, p := range problems {
			fmt.Fprintln(errOut, problemLine(path, p))
		}
		fmt.Fprintf(errOut, "%s: %s in %s\n", name, countedProblems(len(problems)), path)

		return exitFailed
	}

	fmt.Fprintf(out, "%s: %s, all attributed and classified\n", path, countedFindings(len(ledger.Entries)))

	return exitOK
}

// runFindingsRecur counts the findings of each class and checks that a class
// at or over the threshold is named in the decisions ledger.
//
// The counts print whether the run passes or fails, so a reader can see where
// every class stands and not only the one that failed.
func runFindingsRecur(args []string, out, errOut io.Writer) int {
	const name = "groundwork findings recur"

	flags := findingsFlags(errOut, name)
	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	ledgerPath, err := findings.LedgerPath(".")
	if err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}
	decisionsPath, err := findings.DecisionsPath(".")
	if err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	ledger, err := findings.ParseFile(ledgerPath)
	if err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitFailed
	}

	decisions, err := os.ReadFile(decisionsPath)
	if err != nil {
		fmt.Fprintf(errOut, "%s: could not read %s: %v\n", name, decisionsPath, err)
		return exitFailed
	}

	counts, problems := findings.Recur(ledger, string(decisions))

	fmt.Fprint(out, classTable(counts))

	if len(problems) > 0 {
		for _, p := range problems {
			fmt.Fprintln(errOut, problemLine(ledgerPath, p))
		}
		fmt.Fprintf(errOut, "%s: the decisions ledger is %s\n", name, decisionsPath)

		return exitFailed
	}

	fmt.Fprintf(out, "every class at or over %d findings has a decision named from it in %s\n",
		findings.Threshold, decisionsPath)

	return exitOK
}

// problemLine renders one problem, starting with the place a reader has to
// go to fix it: the file, and the line inside it when one line is to blame.
// A problem about an entry or a class also names that entry or class.
func problemLine(path string, p findings.Problem) string {
	where := path
	if p.Line > 0 {
		where = fmt.Sprintf("%s:%d", path, p.Line)
	}
	if p.Where != "" {
		where += ": " + p.Where
	}

	return where + ": " + p.Text
}

// countedProblems renders a count of problems, singular for one.
func countedProblems(n int) string {
	if n == 1 {
		return "1 problem"
	}

	return fmt.Sprintf("%d problems", n)
}

// countedFindings renders a count of findings, singular for one.
func countedFindings(n int) string {
	if n == 1 {
		return "1 finding"
	}

	return fmt.Sprintf("%d findings", n)
}

// classTable renders the class counts as a plain aligned text table, in the
// order given: the largest count first.
func classTable(counts []findings.ClassCount) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	fmt.Fprintln(w, "CLASS\tFINDINGS")
	for _, c := range counts {
		fmt.Fprintf(w, "%s\t%d\n", c.Class, c.Count)
	}

	w.Flush()

	return buf.String()
}
