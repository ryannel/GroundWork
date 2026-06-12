package main

import (
	"fmt"
	"os"
)

// Terminal styling: the tasklet CLI keeps a small, consistent vocabulary so
// output reads the same across commands.
const (
	colorPrimary = "\033[36m" // cyan — headers and board names
	colorSuccess = "\033[32m" // green — confirmations
	colorError   = "\033[31m" // red — failures
	colorReset   = "\033[0m"

	symbolOK   = "✔"
	symbolFail = "✖"
)

func usage() {
	fmt.Fprintln(os.Stderr, `tasklet — manage boards and tasks from the terminal

Usage:
  tasklet boards                      List boards
  tasklet tasks move <id> <status>    Move a task to a new status

Environment:
  TASKLET_API_URL   Base URL of the Tasklet API (default http://localhost:4000)`)
	os.Exit(2)
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	apiURL := os.Getenv("TASKLET_API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:4000"
	}
	switch os.Args[1] {
	case "boards":
		runBoards(apiURL)
	case "tasks":
		if len(os.Args) < 5 || os.Args[2] != "move" {
			usage()
		}
		runTaskMove(apiURL, os.Args[3], os.Args[4])
	default:
		usage()
	}
}
