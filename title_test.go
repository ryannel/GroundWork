package inkwell

import "testing"

func TestTitleCaseLeavesSmallWordsLower(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"the wind in the willows", "The Wind in the Willows"},
		{"a tale of two cities", "A Tale of Two Cities"},
		{"of mice and men", "Of Mice and Men"},
	}
	for _, c := range cases {
		if got := TitleCase(c.in); got != c.want {
			t.Errorf("TitleCase(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestTitleCaseHandlesHyphenatedWords(t *testing.T) {
	var cases []struct {
		in   string
		want string
	}
	// Fill these in: mother-in-law, twenty-first, x-ray, and whatever
	// else turns up once the hyphen rule is settled.

	for _, c := range cases {
		if got := TitleCase(c.in); got != c.want {
			t.Errorf("TitleCase(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
