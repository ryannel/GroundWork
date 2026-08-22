package quantity

import "testing"

var samples = []string{
	"12kg",
	"3.5 m",
	"900ms",
	"7",
	"0.25 l",
	"1500 kWh",
}

func TestParseAcceptsSamples(t *testing.T) {
	for _, in := range samples {
		if _, err := Parse(in); err != nil {
			t.Errorf("Parse(%q) returned an error: %v", in, err)
		}
	}
}

func TestParseIsStable(t *testing.T) {
	for _, in := range samples {
		first, err := Parse(in)
		if err != nil {
			t.Fatalf("Parse(%q): %v", in, err)
		}
		second, err := Parse(in)
		if err != nil {
			t.Fatalf("Parse(%q) on second call: %v", in, err)
		}
		if first != second {
			t.Errorf("Parse(%q) gave %+v then %+v", in, first, second)
		}
	}
}

func TestParseValuesAreNotNegative(t *testing.T) {
	for _, in := range samples {
		q, err := Parse(in)
		if err != nil {
			t.Fatalf("Parse(%q): %v", in, err)
		}
		if q.Value < 0 {
			t.Errorf("Parse(%q).Value = %v, want a positive amount", in, q.Value)
		}
	}
}

func TestStringDoesNotPanic(t *testing.T) {
	for _, in := range samples {
		q, err := Parse(in)
		if err != nil {
			t.Fatalf("Parse(%q): %v", in, err)
		}
		_ = q.String()
	}
}
