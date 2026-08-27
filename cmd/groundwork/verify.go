package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"

	"github.com/ryannel/groundwork/internal/battery"
	"github.com/ryannel/groundwork/internal/journal"
)

// runVerify handles the verify verb.
//
// The verb runs the battery. Its one subcommand, version, prints the battery
// version instead of running anything. Its two flags say what to do with the
// run the verb would otherwise make: --list prints the rows instead of running
// them, and --close runs the bet-close scope.
//
// A subcommand rather than a flag for version because it does a different job
// from a run: it reads the lock file and prints, and it never touches the
// journal. The flags stay flags because both answer a question about the run
// itself.
func runVerify(args []string, out, errOut io.Writer) int {
	if len(args) > 0 && args[0] == "version" {
		return runVerifyVersion(args[1:], out, errOut)
	}

	const name = "groundwork verify"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, verifyUsage) }

	list := flags.Bool("list", false, "list the rows and run nothing")
	closing := flags.Bool("close", false, "run the bet-close scope")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}
	if *list && *closing {
		// One asks to run the close scope and the other asks to run nothing.
		// Picking one of them silently would answer a question nobody asked.
		fmt.Fprintln(errOut, name+": --list and --close ask for opposite things")
		fmt.Fprint(errOut, verifyUsage)

		return exitUsage
	}

	reg := battery.Default()

	if *list {
		fmt.Fprint(out, rowTable(reg))
		return exitOK
	}

	run := battery.Run
	if *closing {
		run = battery.RunClose
	}

	res, err := run(".", reg)
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	fmt.Fprintf(out, "run %s\nbattery %s\n", res.ID, res.Version)

	// After the run's own two lines and before the table, because it says what
	// this run was rather than what it found.
	if *closing {
		fmt.Fprintln(out, closeHeading+" "+strings.Join(battery.CloseScope(), ", "))
	}

	fmt.Fprint(out, resultTable(res))
	fmt.Fprint(out, notes(res))
	fmt.Fprintln(out, summary(res))

	if *closing && refuseClose(errOut, name, res) {
		return exitFailed
	}

	if res.Failed() {
		return exitFailed
	}

	return exitOK
}

// runVerifyVersion prints the battery version: the declared half from the
// lock file, and the digest the rows compute.
//
// It fails when the two disagree. The verb is called verify, and a verify
// subcommand that printed a drifted pair as though it were fine would be
// reporting the drift as news rather than as a fault.
//
// The declared half comes from the HEAD blob, the same read the version row
// gets under R15. Two verbs reading one file from two places would be two
// answers about this battery's version. The committed lock file exists so there
// is one.
//
// A working tree that declares something else is said, and it fails too. An
// uncommitted bump is not a version anybody can be held to. Printing the
// committed one in silence would leave whoever just edited the file looking at
// a number they did not write.
func runVerifyVersion(args []string, out, errOut io.Writer) int {
	const name = "groundwork verify version"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, verifyUsage) }

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	digest := battery.Default().Digest()

	lock, err := battery.ReadLockAtHead(".")
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	if tree, err := battery.ReadLock("."); err != nil || tree != lock {
		fmt.Fprintf(errOut, "%s: HEAD declares %s, and the working tree's %s does not agree: %s\n",
			name, battery.VersionString(lock.Version, lock.Digest), battery.LockFile,
			treeSays(tree, err))

		return exitFailed
	}

	if lock.Digest != digest {
		fmt.Fprintf(errOut, "%s: %s declares the digest %s, but the rows compute %s\n",
			name, battery.LockFile, lock.Digest, digest)
		return exitFailed
	}

	fmt.Fprintln(out, battery.VersionString(lock.Version, digest))

	return exitOK
}

// treeSays is what the working tree's copy of the lock file says, for the line
// that reports it disagreeing with HEAD.
func treeSays(tree battery.Lock, err error) string {
	if err != nil {
		return "it does not read: " + err.Error()
	}

	return "it declares " + battery.VersionString(tree.Version, tree.Digest)
}

// closeHeading opens the line that says a run was a bet close, and names the
// rows the close scope requires beyond the full suite.
//
// D7's ceremony list becomes this: a scope the tool runs and checks, rather
// than a page of steps somebody works through. R14 sets the scope, and later
// bets add their rows to the same list.
const closeHeading = "close scope, beside the full suite:"

// refuseClose reports whether this run may be reported as a bet close, and says
// why when it may not.
//
// The question is what the scope rows came back as, not whether they exist
// (D64 ruling 1). A close is a claim that what a close checks ran and held.
// The version that asked only about registration reported a close over three
// unrunnable rows, and exited zero.
//
// It runs after the table, so a reader sees every row before the refusal. And
// it takes the result rather than reading one, so the refusal can be driven
// with a run that really did come back unrunnable.
func refuseClose(errOut io.Writer, name string, res battery.RunResult) bool {
	unmet := battery.UnmetAtClose(res)
	if len(unmet) == 0 {
		return false
	}

	fmt.Fprintf(errOut, "%s: a bet close runs %s, and this run did not: %s\n",
		name, strings.Join(battery.CloseScope(), ", "), strings.Join(unmet, "; "))

	return true
}

// sayFailed reports why the verb could not finish, and returns its exit code.
//
// Being outside a repository gets the same plain sentence here as it does from
// every other verb, rather than git's own words about a directory.
func sayFailed(errOut io.Writer, name string, err error) int {
	if errors.Is(err, journal.ErrNotARepo) {
		fmt.Fprintln(errOut, name+": not in a git repository")
		return exitFailed
	}

	fmt.Fprintln(errOut, name+":", err)

	return exitFailed
}

// rowTable renders the registered rows as a plain aligned table: what the
// battery holds, before any of it runs.
func rowTable(reg *battery.Registry) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	fmt.Fprintln(w, "ROW\tKIND\tSEVERITY")
	for _, row := range reg.Rows() {
		fmt.Fprintf(w, "%s\t%s\t%s\n", row.ID, row.Kind, row.Severity)
	}
	w.Flush()

	return buf.String()
}

// resultTable renders one run's rows, in the order they ran.
func resultTable(res battery.RunResult) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	fmt.Fprintln(w, "ROW\tOUTCOME\tEVIDENCE")
	for _, row := range res.Rows {
		fmt.Fprintf(w, "%s\t%s\t%s\n", row.ID, row.Outcome, row.Evidence)
	}
	w.Flush()

	return buf.String()
}

// loudHeading introduces the loud block. It is a sentence, not a column
// header, so no reader mistakes what follows for more of the table.
const loudHeading = "what a person has to look at:"

// notes renders the loud block: every row that gave no verdict, and every
// waiver that did not waive anything.
//
// D24 asks that a waiver be printed loudly, and the spec asks the same of a
// quarantined row. A wide table is not loud: a reader scans it for red. So
// these are said again underneath it, in words, with the reason and the expiry
// a person needs to judge whether the waiver should still be there.
//
// The block is set apart from the table by a blank line, a heading, and an
// indent on every line (D38 ruling 5). Without those three a line of the block
// reads as one more row of the table above it, which is exactly what a forged
// waiver was made to look like.
//
// A run where every row gave a verdict and no waiver stands prints nothing
// here at all.
func notes(res battery.RunResult) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 4, 2, ' ', 0)

	wrote := false
	for _, row := range res.Rows {
		if row.Outcome != battery.Waived && row.Outcome != battery.Quarantined {
			continue
		}

		fmt.Fprintf(w, "  %s\t%s\t%s\n", row.Outcome, row.ID, row.Evidence)
		wrote = true
	}

	// A used waiver is already the waived row's own line above. The other
	// three kinds are not on the table at all: an ignored waiver waived
	// nothing, an unused one is waiting for a row that was not red, and an
	// unreadable file is not a waiver.
	for _, note := range res.Waivers {
		if note.Status == battery.WaiverUsed {
			continue
		}

		fmt.Fprintf(w, "  waiver %s\t%s\t%s\n", note.Status, note.File, note.Why)
		wrote = true
	}

	if !wrote {
		return ""
	}

	w.Flush()

	return "\n" + loudHeading + "\n" + buf.String()
}

// summary says how many rows ran and how they came out.
//
// Every outcome is printed, including the ones at zero. A run's summary is
// the line a reader trusts, and an outcome that only appears when it happened
// would let a quarantined row read as an absence.
func summary(res battery.RunResult) string {
	counts := make([]string, 0, len(battery.Outcomes()))
	for _, outcome := range battery.Outcomes() {
		counts = append(counts, fmt.Sprintf("%s %d", outcome, res.Counts[outcome]))
	}

	return fmt.Sprintf("%s: %s", countedRows(len(res.Rows)), strings.Join(counts, ", "))
}

// countedRows renders a count of rows, singular for one.
func countedRows(n int) string {
	if n == 1 {
		return "1 row"
	}

	return fmt.Sprintf("%d rows", n)
}
