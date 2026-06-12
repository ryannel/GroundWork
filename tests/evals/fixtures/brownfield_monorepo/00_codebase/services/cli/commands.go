package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type board struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// runBoards lists every board via GET /boards on the Tasklet API.
func runBoards(apiURL string) {
	resp, err := http.Get(apiURL + "/boards")
	if err != nil {
		fail("api unreachable: " + err.Error())
	}
	defer resp.Body.Close()
	var boards []board
	if err := json.NewDecoder(resp.Body).Decode(&boards); err != nil {
		fail("bad response: " + err.Error())
	}
	fmt.Println(colorPrimary + "Boards" + colorReset)
	for _, b := range boards {
		fmt.Printf("  %s  %s\n", b.ID, b.Name)
	}
}

// runTaskMove moves a task through the workflow via PATCH /tasks/{id}/status.
func runTaskMove(apiURL, id, status string) {
	body, _ := json.Marshal(map[string]string{"status": status})
	req, _ := http.NewRequest(http.MethodPatch, apiURL+"/tasks/"+id+"/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fail("api unreachable: " + err.Error())
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		fail(fmt.Sprintf("move rejected (%d)", resp.StatusCode))
	}
	fmt.Printf("%s%s task %s -> %s%s\n", colorSuccess, symbolOK, id, status, colorReset)
}

func fail(msg string) {
	fmt.Fprintf(os.Stderr, "%s%s %s%s\n", colorError, symbolFail, msg, colorReset)
	os.Exit(1)
}
