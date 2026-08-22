// Package words counts the words in a file.
//
// A word is a run of characters with whitespace on each side. That is the
// rule strings.Fields uses. It is rough, but it is the same rough rule for
// every file, so the counts compare fairly over time.
package words

import (
	"fmt"
	"os"
	"strings"
)

// CountFile returns the number of words in the file at path.
// It returns 0 and an error if the file cannot be read.
func CountFile(path string) (int, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, fmt.Errorf("read %s: %w", path, err)
	}
	return len(strings.Fields(string(content))), nil
}
