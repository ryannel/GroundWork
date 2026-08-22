// Command wordcount counts the words in each file it is given.
// It prints a markdown table: one row per file, then a total row.
// CI runs it over the harness pages and publishes the table.
package main

import (
	"fmt"
	"io"
	"os"

	"github.com/ryannel/groundwork/internal/words"
)

func main() {
	paths := os.Args[1:]
	if len(paths) == 0 {
		fmt.Fprintln(os.Stderr, "usage: wordcount <file> [file...]")
		os.Exit(2)
	}

	if err := run(os.Stdout, paths); err != nil {
		fmt.Fprintln(os.Stderr, "wordcount:", err)
		os.Exit(1)
	}
}

// run writes the table for paths to out.
// It stops at the first file it cannot read.
func run(out io.Writer, paths []string) error {
	counts := make([]int, len(paths))
	total := 0

	for i, path := range paths {
		count, err := words.CountFile(path)
		if err != nil {
			return err
		}
		counts[i] = count
		total += count
	}

	fmt.Fprintln(out, "| File | Words |")
	fmt.Fprintln(out, "| --- | ---: |")
	for i, path := range paths {
		fmt.Fprintf(out, "| %s | %d |\n", path, counts[i])
	}
	fmt.Fprintf(out, "| **Total** | **%d** |\n", total)

	return nil
}
