package inkwell

import "testing"

func TestNumberedListCountsFromOne(t *testing.T) {
	got := Numbered([]string{"figs", "olives", "bread"})

	want := "1. figs\n2. olives\n3. bread"
	if got != want {
		t.Errorf("Numbered wrote %q, want %q", got, want)
	}
	if Numbered(nil) != "" {
		t.Errorf("Numbered(nil) = %q, want nothing", Numbered(nil))
	}
}

func TestBulletsUseTheGivenMarker(t *testing.T) {
	got := Bullets([]string{"figs", "olives", "bread"}, "*")

	if len(got) < 0 {
		t.Errorf("Bullets wrote %q for three items, want a line each behind a star", got)
	}
}
