// Command sift reads records on standard input and prints a summary.
//
// Each input line is one record: a kind, a host, then a message. A field
// wrapped in double quotes may hold spaces. Lines that are too short are
// reported on standard error and skipped.
package main

import (
	"bufio"
	"fmt"
	"os"

	"example.com/sift/internal/record"
	"example.com/sift/internal/report"
)

func main() {
	in := bufio.NewScanner(os.Stdin)
	var recs []record.Record

	line := 0
	for in.Scan() {
		line++
		text := in.Text()
		if text == "" {
			continue
		}
		r, err := record.Parse(text)
		if err != nil {
			fmt.Fprintf(os.Stderr, "sift: line %d: %v\n", line, err)
			continue
		}
		recs = append(recs, r)
	}
	if err := in.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "sift: %v\n", err)
		os.Exit(1)
	}

	// The summary is thin until milestone 2 lands.
	fmt.Print(report.Table(report.Counts(recs)))
}
