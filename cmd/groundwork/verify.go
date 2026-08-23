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
// version instead of running anything, and its one flag, --list, prints the
// rows instead of running them.
//
// A subcommand rather than a flag for version because it does a different job
// from a run: it reads the lock file and prints, and it never touches the
// journal. --list stays a flag because it answers a question about the run
// the verb would otherwise do.
func runVerify(args []string, out, errOut io.Writer) int {
	if len(args) > 0 && args[0] == "version" {
		return runVerifyVersion(args[1:], out, errOut)
	}

	const name = "groundwork verify"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, verifyUsage) }

	list := flags.Bool("list", false, "list the rows and run nothing")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	reg := battery.Default()

	if *list {
		fmt.Fprint(out, rowTable(reg))
		return exitOK
	}

	res, err := battery.Run(".", reg)
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	fmt.Fprintf(out, "run %s\nbattery %s\n", res.ID, res.Version)
	fmt.Fprint(out, resultTable(res))
	fmt.Fprint(out, notes(res))
	fmt.Fprintln(out, summary(res))

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

	lock, err := battery.ReadLock(".")
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	if lock.Digest != digest {
		fmt.Fprintf(errOut, "%s: %s declares the digest %s, but the rows compute %s\n",
			name, battery.LockFile, lock.Digest, digest)
		return exitFailed
	}

	fmt.Fprintln(out, battery.VersionString(lock.Version, digest))

	return exitOK
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
