package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/ryannel/groundwork/internal/seal"
)

const sealUsage = `usage: groundwork seal <subcommand> [flags]

subcommands:
  grant     seal a set of paths under a kind and a subject
  verify    check every seal, or one named seal, against HEAD
  restore   rehydrate the seal tags from the mirror branch
  amend     move a seal, with a reason, printing what changed

A seal is an annotated git tag naming the paths it covers and their blob hashes
at the sealed commit. This tool never holds or creates a signing key: it only
verifies, so every seal it grants is unsigned and says so.
`

const sealGrantUsage = `usage: groundwork seal grant --kind <kind> --subject <id> --path <path> [--path <path>]

flags:
  --kind      what kind of seal it is: %s
  --subject   what it seals, as an id
  --path      one path it covers, from the repo root. Repeat it for more.
`

const sealAmendUsage = `usage: groundwork seal amend --kind <kind> --subject <id> --reason <why> --path <path> [--path <path>]

amend moves a seal. It prints what the tag held and what it holds now, files
the tag it replaced in the mirror, and writes the journal lines. An unsigned
amendment is agent-recorded, and never the owner's own word.

flags:
  --kind      what kind of seal it is: %s
  --subject   what it seals, as an id
  --reason    why it moved. Required.
  --path      one path it covers after the move. Repeat it for more.
`

const sealVerifyUsage = `usage: groundwork seal verify [tag]

verify recomputes each covered path's blob hash at HEAD and names every path
that moved. With no argument it checks every seal in the repo. With a tag it
checks that one, and a tag that is not there is missing, which is red.
`

const sealRestoreUsage = `usage: groundwork seal restore

restore rehydrates the seal tags from the mirror branch, byte for byte. A name
already taken by a different object is never overwritten.
`

// runSeal handles the seal verb.
func runSeal(args []string, out, errOut io.Writer) int {
	if len(args) == 0 {
		fmt.Fprint(errOut, sealUsage)
		return exitUsage
	}

	switch args[0] {
	case "grant":
		return runSealGrant(args[1:], out, errOut)
	case "verify":
		return runSealVerify(args[1:], out, errOut)
	case "restore":
		return runSealRestore(args[1:], out, errOut)
	case "amend":
		return runSealAmend(args[1:], out, errOut)
	default:
		fmt.Fprintf(errOut, "groundwork seal: unknown subcommand %q\n\n", args[0])
		fmt.Fprint(errOut, sealUsage)
		return exitUsage
	}
}

// paths collects a flag given more than once. A seal covers a list, and a list
// is how the flag is written: one --path per path.
type paths []string

func (p *paths) String() string {
	return strings.Join(*p, ", ")
}

func (p *paths) Set(value string) error {
	*p = append(*p, value)

	return nil
}

// runSealGrant makes one seal.
//
// There is no --battery flag. The version pair is read from the journal's own
// newest battery run, so a seal cannot claim a version that never ran.
func runSealGrant(args []string, out, errOut io.Writer) int {
	const name = "groundwork seal grant"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() {
		fmt.Fprintf(errOut, sealGrantUsage, strings.Join(seal.Kinds(), ", "))
	}

	kind := flags.String("kind", "", "what kind of seal it is")
	subject := flags.String("subject", "", "what it seals, as an id")
	var covered paths
	flags.Var(&covered, "path", "one path it covers, from the repo root")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	wrong := emptyFlags(given{"--kind", *kind}, given{"--subject", *subject})
	if len(covered) == 0 {
		wrong = append(wrong, "--path needs at least one path")
	}
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	granted, err := seal.GrantSeal(".", seal.Grant{
		Kind: *kind, Subject: *subject, Paths: covered,
	})
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	fmt.Fprint(out, grantLines(granted))

	return exitOK
}

// grantLines says what a grant made: the tag and its commit, what it covers and
// under which battery run, what its signature is worth, and where it is
// mirrored.
func grantLines(g seal.Granted) string {
	var b strings.Builder

	fmt.Fprintf(&b, "granted %s at %s\n", plain(g.Tag), plain(g.Target))
	fmt.Fprintf(&b, "  covers %s, under battery %s from %s\n",
		countedThings(len(g.Covered), "path", "paths"), plain(g.Battery), plain(g.BatteryRun))
	fmt.Fprintf(&b, "  %s: this tool holds no signing key, so this seal is no one's authority\n",
		plain(string(g.Signature)))
	fmt.Fprintf(&b, "  mirrored on %s\n", seal.Branch)

	return b.String()
}

// runSealVerify checks every seal, or the one named.
func runSealVerify(args []string, out, errOut io.Writer) int {
	const name = "groundwork seal verify"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, sealVerifyUsage) }

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if flags.NArg() > 1 {
		return sayWrong(errOut, flags, name, []string{"verify takes one tag, or none at all"})
	}

	if flags.NArg() == 1 {
		return runSealVerifyOne(flags.Arg(0), out, errOut, name)
	}

	rep, err := seal.Verify(".")
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	if rep.Seals == 0 {
		fmt.Fprintln(out, "this repo holds no seal tag, so there is nothing to verify")
		return exitOK
	}

	for _, res := range rep.Results {
		fmt.Fprint(out, sealLines(res))
	}
	fmt.Fprintln(out, sealSummary(rep))

	if rep.Problems > 0 {
		return exitFailed
	}

	return exitOK
}

// runSealVerifyOne checks one named seal. A seal that is not there is missing,
// and missing is the one signature state that is red.
//
// A name that is not a seal tag's is refused before anything is read. F66: the
// verb read any annotated tag, so asking it about a release tag quoted that
// tag's own text back through seal machinery, as though a seal had failed.
func runSealVerifyOne(tag string, out, errOut io.Writer, name string) int {
	if err := seal.CheckTagName(tag); err != nil {
		fmt.Fprintln(errOut, name+":", err)
		return exitUsage
	}

	res, err := seal.VerifyTag(".", tag)
	if err != nil {
		if errors.Is(err, seal.ErrNoSeal) {
			fmt.Fprintln(errOut, name+":", err)
			return exitFailed
		}

		return sayFailed(errOut, name, err)
	}

	fmt.Fprint(out, sealLines(res))

	if !res.Sound() {
		return exitFailed
	}

	return exitOK
}

// sealLines renders one checked seal: what it is, what its signature is worth,
// what became of each covered path, what battery it was granted under, and
// every problem it has.
//
// Every value here comes off a tag, and a tag message is written by whoever can
// write a tag. So every one of them goes through plain, per D38 ruling 4 and
// D49 ruling 2: a newline in a tag would otherwise draw a line of its own.
func sealLines(res seal.Result) string {
	var b strings.Builder

	fmt.Fprintf(&b, "%s at %s\n", plain(res.Tag), plain(res.Target))
	fmt.Fprintf(&b, "  signature %s: %s\n", plain(string(res.Signature)), plain(res.SignatureNote))

	for _, one := range res.Covered {
		switch one.State {
		case seal.Held:
			fmt.Fprintf(&b, "  %s holds at %s\n", plain(one.Path), plain(one.Sealed))
		case seal.Moved:
			fmt.Fprintf(&b, "  %s moved: sealed %s, and HEAD holds %s\n",
				plain(one.Path), plain(one.Sealed), plain(one.Now))
		case seal.Gone:
			fmt.Fprintf(&b, "  %s is gone at HEAD, and it was sealed at %s\n",
				plain(one.Path), plain(one.Sealed))
		}
	}

	fmt.Fprintf(&b, "  battery %s from %s: %s\n",
		plain(res.Battery), plain(res.BatteryRun), plain(batteryStanding(res)))

	for _, problem := range res.Problems {
		fmt.Fprintf(&b, "  problem: %s\n", plain(problem))
	}

	return b.String()
}

// batteryStanding says what came of the cross-check between the tag's trailers
// and the journal's seal line. A cross-check that did not run is said in its
// own words, and never as though it passed.
func batteryStanding(res seal.Result) string {
	if res.Battery == "" {
		return "this tag carries no battery trailers anybody can read"
	}
	if res.BatteryNote != "" {
		return res.BatteryNote
	}
	if res.JournalBattery == res.Battery && res.JournalBatteryRun == res.BatteryRun {
		return "the seal line says the same"
	}

	return fmt.Sprintf("the seal line says %s from %s", res.JournalBattery, res.JournalBatteryRun)
}

// sealSummary is the line a reader trusts. Every count is printed, including
// the ones at zero: a count that only appeared when it happened would let a
// moved path read as an absence.
func sealSummary(rep seal.Report) string {
	return fmt.Sprintf("%s, %s, %d moved, %d unsigned, %d unverified, %s",
		countedThings(rep.Seals, "seal", "seals"),
		countedThings(rep.Paths, "path", "paths"),
		rep.Moved,
		rep.Unsigned,
		rep.Unverified,
		countedThings(rep.Problems, "problem", "problems"))
}

// runSealRestore rehydrates the seal tags from the mirror.
func runSealRestore(args []string, out, errOut io.Writer) int {
	const name = "groundwork seal restore"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() { fmt.Fprint(errOut, sealRestoreUsage) }

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	res, err := seal.Restore(".")
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	if !res.HasMirror {
		fmt.Fprintf(out, "this repo has no %s branch, so there is no seal to restore\n", seal.Branch)
		return exitOK
	}

	// The files the restore would not read are said first, because they are the
	// part somebody has to go and look at. A mirror is pushable on purpose, so
	// a file on it that is not a seal tag is somebody's doing.
	for _, one := range res.Ignored {
		fmt.Fprintf(out, "ignored %s: %s\n", plain(one.Path), plain(one.Why))
	}

	restored, already, mismatched := 0, 0, 0
	for _, one := range res.Tags {
		fmt.Fprintln(out, restoredLine(one))

		switch one.Status {
		case seal.RestoreDone:
			restored++
		case seal.RestoreAlready:
			already++
		default:
			mismatched++
		}
	}

	fmt.Fprintf(out, "%s: restored %d, already there %d, mismatched %d\n",
		countedThings(len(res.Tags), "tag", "tags"), restored, already, mismatched)

	if mismatched > 0 {
		return exitFailed
	}

	return exitOK
}

// restoredLine says what a restore did with one tag, and why when it did
// nothing.
func restoredLine(one seal.Restored) string {
	line := fmt.Sprintf("%s %s at %s", plain(string(one.Status)), plain(one.Tag), plain(one.OID))
	if one.Why == "" {
		return line
	}

	return line + ": " + plain(one.Why)
}

// runSealAmend moves one seal.
func runSealAmend(args []string, out, errOut io.Writer) int {
	const name = "groundwork seal amend"

	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(errOut)
	flags.Usage = func() {
		fmt.Fprintf(errOut, sealAmendUsage, strings.Join(seal.Kinds(), ", "))
	}

	kind := flags.String("kind", "", "what kind of seal it is")
	subject := flags.String("subject", "", "what it seals, as an id")
	reason := flags.String("reason", "", "why it moved")
	var covered paths
	flags.Var(&covered, "path", "one path it covers after the move")

	if err := flags.Parse(args); err != nil {
		return exitUsage
	}
	if spareArgument(errOut, flags, name) {
		return exitUsage
	}

	wrong := emptyFlags(
		given{"--kind", *kind},
		given{"--subject", *subject},
		given{"--reason", *reason},
	)
	if len(covered) == 0 {
		wrong = append(wrong, "--path needs at least one path")
	}
	if len(wrong) > 0 {
		return sayWrong(errOut, flags, name, wrong)
	}

	got, err := seal.AmendSeal(".", seal.Amendment{
		Kind: *kind, Subject: *subject, Paths: covered, Reason: *reason,
	})
	if err != nil {
		return sayFailed(errOut, name, err)
	}

	fmt.Fprint(out, amendLines(got))

	return exitOK
}

// amendLines prints the before and the after, which is what R6 asks for, and
// then what the amended tag's signature is worth.
func amendLines(a seal.Amended) string {
	var b strings.Builder

	fmt.Fprintf(&b, "%s\n", plain(a.Tag))
	fmt.Fprintf(&b, "  before: %s at %s\n",
		countedThings(len(a.Before.Covered), "path", "paths"), plain(a.Before.Target))
	fmt.Fprintf(&b, "  after:  %s at %s\n",
		countedThings(len(a.After.Covered), "path", "paths"), plain(a.After.Target))

	// The counts alone say nothing about what moved: two before and two after
	// can be two different pairs. R6 asks for the before and the after, so the
	// paths that differ are named.
	went := pathsMissing(a.Before.Covered, a.After.Covered)
	came := pathsMissing(a.After.Covered, a.Before.Covered)

	if len(went) == 0 && len(came) == 0 {
		fmt.Fprintln(&b, "  covers: the same paths as before")
	}
	if len(went) > 0 {
		fmt.Fprintf(&b, "  no longer covers: %s\n", plain(listedPaths(went)))
	}
	if len(came) > 0 {
		fmt.Fprintf(&b, "  now covers: %s\n", plain(listedPaths(came)))
	}

	fmt.Fprintf(&b, "  reason: %s\n", plain(a.Reason))
	fmt.Fprintf(&b, "  %s\n", plain(a.Note))

	return b.String()
}

// pathsMissing returns the paths in one list that the other does not hold.
func pathsMissing(from, other []seal.Covered) []string {
	held := map[string]bool{}
	for _, one := range other {
		held[one.Path] = true
	}

	var missing []string
	for _, one := range from {
		if !held[one.Path] {
			missing = append(missing, one.Path)
		}
	}

	return missing
}

// listedPaths renders a few paths and says how many it left out. A seal can
// cover a long list, and a line that named every one of them would bury the
// reason underneath it.
func listedPaths(all []string) string {
	const most = 5

	if len(all) <= most {
		return strings.Join(all, ", ")
	}

	return fmt.Sprintf("%s and %d more", strings.Join(all[:most], ", "), len(all)-most)
}

// countedThings renders a count with its noun, singular for one.
func countedThings(n int, one, many string) string {
	if n == 1 {
		return "1 " + one
	}

	return fmt.Sprintf("%d %s", n, many)
}

// plain renders somebody else's text safe to print, and short enough to read.
//
// Every character that is not printable becomes a space. A newline in a tag
// message would otherwise draw a line of its own in this output, and a run that
// prints a forged line is worse than one that prints nothing.
func plain(text string) string {
	const most = 300

	text = strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}

		return ' '
	}, strings.ToValidUTF8(text, ""))

	if len(text) <= most {
		return text
	}

	const mark = "..."

	kept := text[:most-len(mark)]
	for len(kept) > 0 && !utf8.ValidString(kept) {
		kept = kept[:len(kept)-1]
	}

	return kept + mark
}
