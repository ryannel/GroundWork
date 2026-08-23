package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/ryannel/groundwork/internal/battery"
	"github.com/ryannel/groundwork/internal/journal"
)

const waiveUsage = `usage: groundwork waive <row> --reason <why> --expires <YYYY-MM-DD>

waive writes one waiver file under ` + battery.WaiverDir + ` and records the
grant in the journal. It never commits: the commit is yours, and the git
attribution it carries is what makes the waiver count.

A waiver never turns a row green. The row reports waived, loudly, until the
waiver expires.

flags:
  --reason    why the check is wrong, in one line
  --expires   the date it runs out, at most 30 days out
`

// runWaive handles the waive verb.
//
// The row comes as an argument rather than a flag, the same call D15 made for
// merge: a waiver has exactly one row and it is not optional, so a flag would
// dress it as one.
func runWaive(args []string, out, errOut io.Writer) int {
	const name = "groundwork waive"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, waiveUsage) }

	reason := flags.String("reason", "", "why the check is wrong")
	expires := flags.String("expires", "", "the date the waiver runs out, YYYY-MM-DD")

	// The row is taken off the front before the flags are parsed. Go's flag
	// package stops at the first argument that is not a flag, so a row written
	// where a person would write it — first — would otherwise swallow the
	// flags after it.
	row := ""
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		row, args = args[0], args[1:]
	}

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}

	// One true thing. A spare argument stops the parser where it stands, so
	// every flag after it reads as missing — and saying that a flag the person
	// wrote is missing sends them to fix the wrong half of the line.
	if flags.NArg() > 0 {
		return sayWrong(errOut, flags, name,
			[]string{fmt.Sprintf("unexpected argument %q: waive takes one row", flags.Arg(0))})
	}

	var wrong []string
	if row == "" {
		wrong = append(wrong, "waive takes the row to waive, written first")
	}
	wrong = append(wrong, emptyFlags(
		given{"--reason", *reason},
		given{"--expires", *expires},
	)...)
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	path, err := battery.Grant(".", row, *reason, *expires)
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	fmt.Fprintln(out, fromHere(path))
	fmt.Fprintln(out, "now commit that file in its own commit, touching nothing else, or the waiver will not stand")

	return exitOK
}

// fromHere turns a path named from the repo root into one that works from
// where the person is standing. The verb prints a path to be committed, and a
// path copied out of a subdirectory has to name the file from there.
//
// The repo-root path is what the record keeps — the journal line and the
// waiver's own identity — so only what is printed changes.
func fromHere(path string) string {
	root, err := journal.RepoRoot(".")
	if err != nil {
		return path
	}

	here, err := os.Getwd()
	if err != nil {
		return path
	}

	from, err := filepath.Rel(here, filepath.Join(root, filepath.FromSlash(path)))
	if err != nil {
		return path
	}

	return from
}
