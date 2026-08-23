package adapter

import "testing"

// Name is how a run says which stack an answer came from, and the battery
// matches it against the manifest's stack. Nothing asserted it, so deleting it
// left the adapter package's 46 tests green (F29).
func TestExecNameIsTheStackItWasBuiltFor(t *testing.T) {
	for _, name := range []string{"node", "python"} {
		e := NewExec(name, []string{"true"})
		if e.Name() != name {
			t.Errorf("an adapter built for %q calls itself %q", name, e.Name())
		}
	}
}
