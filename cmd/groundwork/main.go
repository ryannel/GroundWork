// Command groundwork is the GroundWork command line tool.
//
// It runs one verb per invocation: groundwork <verb> [flags]. It exits 0 when
// the work is done, 1 when the work failed, and 2 when the command line was
// wrong.
//
// main stays thin. The work lives in the internal packages.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/ryannel/groundwork/internal/journal"
)

// The exit codes the tool promises.
const (
	exitOK     = 0
	exitFailed = 1
	exitUsage  = 2
)

const usage = `usage: groundwork <verb> [flags]

verbs:
  journal   record an event in the journal
`

const journalUsage = `usage: groundwork journal <subcommand> [flags]

subcommands:
  dispatch   record one dispatch of an agent
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
	default:
		fmt.Fprintf(errOut, "groundwork journal: unknown subcommand %q\n\n", args[0])
		fmt.Fprint(errOut, journalUsage)
		return exitUsage
	}
}

// notGiven is the default for the number flags. Every real count is zero or
// more, so this value marks a flag the caller left out.
const notGiven = -1

// runJournalDispatch records one dispatch event.
func runJournalDispatch(args []string, out, errOut io.Writer) int {
	flags := flag.NewFlagSet("groundwork journal dispatch", flag.ContinueOnError)
	flags.SetOutput(errOut)

	role := flags.String("role", "", "who was dispatched")
	tier := flags.String("tier", "", "which model tier ran it")
	tokensIn := flags.Int("tokens-in", notGiven, "input tokens")
	tokensOut := flags.Int("tokens-out", notGiven, "output tokens")
	durationMS := flags.Int("duration-ms", notGiven, "how long it took, in milliseconds")
	outcome := flags.String("outcome", "", "how it ended")
	tokensSource := flags.String("tokens-source", "unset", "where the token counts came from")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if flags.NArg() > 0 {
		fmt.Fprintf(errOut, "groundwork journal dispatch: unexpected argument %q\n", flags.Arg(0))
		flags.Usage()
		return exitUsage
	}

	var wrong []string
	for _, f := range []struct {
		name  string
		value string
	}{
		{"--role", *role},
		{"--tier", *tier},
		{"--outcome", *outcome},
		{"--tokens-source", *tokensSource},
	} {
		if f.value == "" {
			wrong = append(wrong, f.name+" needs a value")
		}
	}
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
		for _, problem := range wrong {
			fmt.Fprintln(errOut, "groundwork journal dispatch:", problem)
		}
		flags.Usage()
		return exitUsage
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
	if errors.Is(err, journal.ErrNotARepo) {
		fmt.Fprintln(errOut, "groundwork journal dispatch: not in a git repository")
		return exitFailed
	}
	if err != nil {
		fmt.Fprintln(errOut, "groundwork journal dispatch:", err)
		return exitFailed
	}

	fmt.Fprintln(out, path)

	return exitOK
}
