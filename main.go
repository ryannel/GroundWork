// Command ledgerline reads a plain-text ledger and reports account totals.
package main

import (
	"fmt"
	"io"
	"os"
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
	fmt.Fprintln(stderr, "ledgerline: not built yet")
	return 1
}
