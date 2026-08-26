package adapter

import (
	"strings"
	"testing"

	"github.com/ryannel/groundwork/internal/manifest"
)

// For is the one place a caller with a manifest picks a stack's adapter. It
// moved here from the battery so that the rows, the board and whatever comes
// next cannot pick different ones (D54 ruling 1) — and the move brought a
// branch nothing drove with it: blanking the refusal left the whole suite
// green, unfiltered (F79).
//
// D25 is what it holds to. Go runs in process, every other stack runs the
// command the manifest declares, and a stack the manifest maps to nothing is
// refused rather than guessed at. What the caller does with the refusal is the
// caller's: the manifest row turns it red, and every other caller reports
// unrunnable, so one cause draws one red.

// forSurface builds a one-surface manifest on a stack, with or without an
// adapter command declared for it.
func forSurface(stack string, declared bool) (manifest.Manifest, manifest.Surface) {
	surface := manifest.Surface{Name: "the surface", Profile: "cli", Stack: stack, Root: "."}

	m := manifest.Manifest{Schema: 1, Surfaces: []manifest.Surface{surface}}
	if declared {
		m.Adapters = map[string]manifest.Runner{stack: {Command: []string{"node", "adapter.mjs"}}}
	}

	return m, surface
}

func TestForGivesTheInProcessAdapterToGo(t *testing.T) {
	m, surface := forSurface(manifest.GoStack, false)

	a, err := For(m, surface)
	if err != nil {
		t.Fatalf("For refused a Go surface: %v", err)
	}
	if _, ok := a.(*Go); !ok {
		t.Errorf("For gave a Go surface a %T", a)
	}
	if a.Name() != manifest.GoStack {
		t.Errorf("the adapter names the stack %q, want %q", a.Name(), manifest.GoStack)
	}
}

func TestForGivesTheDeclaredCommandToEveryOtherStack(t *testing.T) {
	m, surface := forSurface("node", true)

	a, err := For(m, surface)
	if err != nil {
		t.Fatalf("For refused a declared node surface: %v", err)
	}
	if _, ok := a.(*Exec); !ok {
		t.Errorf("For gave a node surface a %T", a)
	}
	if a.Name() != "node" {
		t.Errorf("the adapter names the stack %q, want node", a.Name())
	}
}

// The refusal. A stack the manifest maps to nothing must never come back as an
// adapter that will quietly run nothing: D25 fails closed, and the error names
// the surface, the stack and the file that has to declare it.
func TestForRefusesAStackNoAdapterMaps(t *testing.T) {
	m, surface := forSurface("node", false)

	a, err := For(m, surface)
	if err == nil {
		t.Fatalf("For gave an unmapped stack a %T", a)
	}
	if a != nil {
		t.Errorf("For refused an unmapped stack and gave back a %T anyway", a)
	}

	for _, want := range []string{surface.Name, surface.Stack, manifest.File} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("the refusal is %q, and it does not name %q", err, want)
		}
	}
}
