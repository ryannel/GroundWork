package words

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCountFile(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    int
	}{
		{"empty file", "", 0},
		{"one word", "hello", 1},
		{"blank space only", "   \n\t\n  ", 0},
		{"words on one line", "one two three", 3},
		{"words over several lines", "one two\nthree\n\nfour five\n", 5},
		{"punctuation stays with its word", "Hello, world! It's fine.", 4},
		{"runs of space count once", "one   two\t\tthree\n\n\nfour", 4},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "sample.txt")
			if err := os.WriteFile(path, []byte(c.content), 0o600); err != nil {
				t.Fatalf("could not write the test file: %v", err)
			}

			got, err := CountFile(path)
			if err != nil {
				t.Fatalf("CountFile returned an error: %v", err)
			}
			if got != c.want {
				t.Errorf("CountFile got %d words, want %d", got, c.want)
			}
		})
	}
}

func TestCountFileMissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "not-here.txt")

	got, err := CountFile(path)
	if err == nil {
		t.Fatalf("CountFile should fail on a missing file, got count %d", got)
	}
	if got != 0 {
		t.Errorf("CountFile should return 0 words on error, got %d", got)
	}
}
