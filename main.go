// Command ledgerline reads a plain-text ledger and reports account totals.
package main

import (
	"fmt"
	"io"
	"os"

	"github.com/mkerrigan/ledgerline/internal/ledger"
	"github.com/mkerrigan/ledgerline/internal/report"
)

const usage = `usage: ledgerline totals <file>`

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, usage)
		return 2
	}

	switch args[0] {
	case "totals":
		if len(args) != 2 {
			fmt.Fprintln(stderr, usage)
			return 2
		}
		if err := totals(args[1], stdout); err != nil {
			fmt.Fprintf(stderr, "ledgerline: %v\n", err)
			return 1
		}
		return 0
	default:
		fmt.Fprintf(stderr, "ledgerline: unknown command %q\n", args[0])
		fmt.Fprintln(stderr, usage)
		return 2
	}
}

func totals(path string, stdout io.Writer) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	entries, err := ledger.ParseLedger(file)
	if err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return report.Render(stdout, ledger.Balances(entries))
}
