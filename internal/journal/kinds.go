package journal

import (
	"fmt"
	"slices"
	"strings"
)

// kinds is the closed vocabulary for a line's kind.
//
// The spec lists the events the CLI logs (loop.md), and each one lands as a
// kind here when its bet builds it. Three are this slice's: waiver, flake and
// drive. The rest of the spec's list — a lane triage, an archive, a hook
// firing — joins the same way, one ruling at a time.
//
// Closed means a reader can be told what a journal may hold. D28 pinned the
// battery's row kinds for the same reason, and a test pins this list.
var kinds = []string{
	"dispatch", "dial", "seal",
	"battery", "battery-row",
	"waiver", "flake", "drive",
}

// checkKind stops a write asking for a kind nobody declared.
//
// It panics rather than returning an error, because the kind is a literal in
// this package's own source: a kind outside the list is a mistake made before
// any caller was involved, and a line recorded under it would be a line no
// reader was ever told to expect.
func checkKind(kind string) {
	if !slices.Contains(kinds, kind) {
		panic(fmt.Sprintf("groundwork: the journal was asked for the kind %q, which is not one of: %s",
			kind, strings.Join(kinds, ", ")))
	}
}
