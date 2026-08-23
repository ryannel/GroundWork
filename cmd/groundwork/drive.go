package main

import (
	"flag"
	"fmt"
	"io"

	"github.com/ryannel/groundwork/internal/journal"
)

const droveUsage = `usage: groundwork drove --notes <what you did>

drove records that you ran the product yourself. The line stamps the commit
HEAD was on when you ran it, and the session you ran it in, so a drive cannot
be claimed for work that landed after it.

flags:
  --notes   what you drove, and what you saw
`

// runDrove handles the drove verb.
//
// The verb is the person's own act, so it records and nothing else. Whether a
// drive is recent enough for a seal is the seal machinery's question, and it
// reads these lines to answer it.
func runDrove(args []string, out, errOut io.Writer) int {
	const name = "groundwork drove"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, droveUsage) }

	notes := flags.String("notes", "", "what you drove, and what you saw")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	wrong := emptyFlags(given{"--notes", *notes})
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	path, err := journal.WriteDrive(".", journal.Drive{Notes: *notes})

	return report(out, errOut, name, path, err)
}
