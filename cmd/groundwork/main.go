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
	"strings"

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
  dial       record a move of the autonomy dial
  seal       record a seal granted or revoked
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
	case "dial":
		return runJournalDial(args[1:], out, errOut)
	case "seal":
		return runJournalSeal(args[1:], out, errOut)
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

// spareArgument reports a leftover argument. No journal subcommand takes one.
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
