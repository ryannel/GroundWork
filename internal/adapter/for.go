package adapter

import (
	"fmt"

	"github.com/ryannel/groundwork/internal/manifest"
)

// For returns the adapter for one surface's stack.
//
// D25: Go runs in process, and every other stack runs the command the
// capability manifest declares. A stack the manifest maps to nothing gets an
// error here, and this refuses rather than guesses — a stack the battery cannot
// read must never pass in silence.
//
// What it does not do is decide the outcome. D25's fail-closed red for an
// unmapped stack belongs to the manifest row, which is the row that judges the
// manifest; every other caller reports unrunnable and leaves the red there, so
// one cause draws one red (F79). This function only says it has no adapter.
//
// It sits here rather than in the battery because it is not a check. Every
// caller that has a manifest and wants to run a surface asks this, and one
// place that answers it is what keeps the rows, the board and whatever comes
// next picking the same adapter (D54 ruling 1).
func For(m manifest.Manifest, surface manifest.Surface) (Adapter, error) {
	if surface.Stack == manifest.GoStack {
		return NewGo(), nil
	}

	runner, ok := m.Adapters[surface.Stack]
	if !ok {
		return nil, fmt.Errorf("the surface %q is written in %s, and %s declares no adapter for it",
			surface.Name, surface.Stack, manifest.File)
	}

	return NewExec(surface.Stack, runner.Command), nil
}
