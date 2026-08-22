package csvline

import (
	"reflect"
	"testing"
)

func TestSplit(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []string
	}{
		{"plain fields", "a,b,c", []string{"a", "b", "c"}},
		{"spaces trimmed", " a , b ,c", []string{"a", "b", "c"}},
		{"empty fields kept", "a,,c", []string{"a", "", "c"}},
		{"trailing empty field", "a,b,", []string{"a", "b", ""}},
		{"quoted comma", `a,"b,c",d`, []string{"a", "b,c", "d"}},
		{"quoted spaces kept", `a," padded ",c`, []string{"a", " padded ", "c"}},
		{"doubled quote", `a,"say ""hi""",c`, []string{"a", `say "hi"`, "c"}},
		{"single field", "only", []string{"only"}},
		{"empty line", "", []string{""}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Split(tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("Split(%q) = %#v, want %#v", tc.in, got, tc.want)
			}
		})
	}
}

func TestSplitCountsFields(t *testing.T) {
	line := `1,"Acme, Ltd.",widgets,"12,000",GBP`
	got := Split(line)
	if len(got) != 5 {
		t.Fatalf("Split(%q) returned %d fields: %#v", line, len(got), got)
	}
	if got[1] != "Acme, Ltd." {
		t.Errorf("field 1 = %q, want %q", got[1], "Acme, Ltd.")
	}
	if got[3] != "12,000" {
		t.Errorf("field 3 = %q, want %q", got[3], "12,000")
	}
}
