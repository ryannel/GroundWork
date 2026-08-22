package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

// The protocol an out-of-process adapter speaks, per D25.
//
// The runner executes the declared command with the call as its next argument,
// then the absolute project directory, then the call's own argument if it has
// one:
//
//	<command...> discover <project>
//	<command...> run      <project>
//	<command...> mutants  <project> <file>
//
// The command runs with the project directory as its working directory. It
// prints ONE JSON object on stdout and nothing else:
//
//	{"schema":1,"suites":[{"id":"test/a.test.mjs","name":"a","tests":["adds"]}]}
//	{"schema":1,"duration_ms":12.5,"tests":[{"suite":"…","name":"adds","outcome":"pass","duration_ms":0.9}]}
//	{"schema":1,"mutants":[{"file":"src/a.mjs","symbol":"addsUp","line":3,"content":"…"}]}
//
// Anything else on stdout is a failure, not a hint. stderr is free: it is kept
// only to quote back when something goes wrong.
//
// testdata/adapters/node.mjs is a working implementation for node --test
// projects, in plain .mjs with nothing to install.
const (
	// ProtocolSchema is the schema number a response must declare.
	ProtocolSchema = 1

	// CallDiscover, CallRun and CallMutants are the three calls D25 puts on the
	// seam this bet.
	CallDiscover = "discover"
	CallRun      = "run"
	CallMutants  = "mutants"
)

// DefaultTimeout is how long an out-of-process adapter gets before it is
// killed. D25 asks for a timeout; the number is this slice's recorded default.
const DefaultTimeout = 120 * time.Second

// DefaultCap is how much an out-of-process adapter may print on stdout before
// it is killed. A run log for a large suite is well under this; a stream that
// passes it is a runaway, and reading it to the end would take the machine
// down with it.
const DefaultCap = 8 << 20

// stderrCap is how much of stderr is kept to quote back in an error.
const stderrCap = 8 << 10

// waitDelay is how long the runner waits for a killed process's pipes to close
// before it tears them down itself.
const waitDelay = 2 * time.Second

// Exec is the out-of-process adapter: one declared command, spoken to over the
// protocol above.
type Exec struct {
	name    string
	command []string
	timeout time.Duration
	cap     int
}

// Option changes one of the runner's protections. The defaults are the ones
// D25 asks for; tests turn them down to prove they bite.
type Option func(*Exec)

// Timeout sets how long the command gets.
func Timeout(d time.Duration) Option {
	return func(e *Exec) { e.timeout = d }
}

// Cap sets how much the command may print on stdout.
func Cap(n int) Option {
	return func(e *Exec) { e.cap = n }
}

// NewExec returns an adapter that runs the given command.
func NewExec(name string, command []string, opts ...Option) *Exec {
	e := &Exec{
		name:    name,
		command: slices.Clone(command),
		timeout: DefaultTimeout,
		cap:     DefaultCap,
	}
	for _, opt := range opts {
		opt(e)
	}

	return e
}

// Name is the stack this adapter speaks for.
func (e *Exec) Name() string { return e.name }

// response is the one JSON object an adapter may print.
type response struct {
	Schema     int             `json:"schema"`
	Suites     []suiteJSON     `json:"suites,omitempty"`
	Tests      []testJSON      `json:"tests,omitempty"`
	Mutants    []mutantJSON    `json:"mutants,omitempty"`
	DurationMS json.RawMessage `json:"duration_ms,omitempty"`
}

type suiteJSON struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Tests []string `json:"tests"`
}

type testJSON struct {
	Suite      string  `json:"suite"`
	Name       string  `json:"name"`
	Outcome    string  `json:"outcome"`
	DurationMS float64 `json:"duration_ms"`
}

type mutantJSON struct {
	File    string `json:"file"`
	Symbol  string `json:"symbol"`
	Line    int    `json:"line"`
	Content string `json:"content"`
}

// Discover asks the command for the suites it can see.
func (e *Exec) Discover(ctx context.Context, dir string) ([]Suite, error) {
	res, err := e.call(ctx, dir, CallDiscover)
	if err != nil {
		return nil, err
	}

	suites := make([]Suite, 0, len(res.Suites))
	for _, s := range res.Suites {
		if strings.TrimSpace(s.ID) == "" {
			return nil, fmt.Errorf("%w: %s returned a suite with no id", ErrUnrunnable, e.name)
		}
		for _, name := range s.Tests {
			if strings.TrimSpace(name) == "" {
				return nil, fmt.Errorf("%w: %s returned a test with no name in the suite %s",
					ErrUnrunnable, e.name, s.ID)
			}
		}
		suites = append(suites, Suite{ID: s.ID, Name: s.Name, Tests: slices.Clone(s.Tests)})
	}

	return suites, nil
}

// Run asks the command to run the suites.
//
// A run that could not be believed comes back as no run at all: the zero run
// log and an unrunnable error. D25 rules that a killed run is unrunnable and
// never a partial tally, and a partial tally is exactly what a caller would
// get if the tests parsed so far were handed back with the error.
func (e *Exec) Run(ctx context.Context, dir string) (RunLog, error) {
	res, err := e.call(ctx, dir, CallRun)
	if err != nil {
		return RunLog{}, err
	}

	log := RunLog{Duration: durationOf(res.DurationMS)}
	for _, t := range res.Tests {
		outcome := Outcome(t.Outcome)
		if !slices.Contains(Outcomes(), outcome) {
			return RunLog{}, fmt.Errorf("%w: %s reported the outcome %q for %s, which is not one of: pass, fail, skip",
				ErrUnrunnable, e.name, t.Outcome, t.Name)
		}
		// A nameless result cannot be reconciled against a discovered test, so
		// it would sit in the run log as a row nobody can match.
		if strings.TrimSpace(t.Suite) == "" || strings.TrimSpace(t.Name) == "" {
			return RunLog{}, fmt.Errorf("%w: %s reported a result with no suite or no test name: %+v",
				ErrUnrunnable, e.name, t)
		}

		log.Tests = append(log.Tests, TestRun{
			ID:       TestID(t.Suite, t.Name),
			Suite:    t.Suite,
			Name:     t.Name,
			Outcome:  outcome,
			Duration: time.Duration(t.DurationMS * float64(time.Millisecond)),
		})
	}

	// D30: subtests fold into their parent, and an empty run log is refused —
	// the same direction as the Go path, because an empty green log is the
	// defect the battery exists to catch.
	log.Tests = collapse(log.Tests)
	if len(log.Tests) == 0 {
		return RunLog{}, fmt.Errorf("%w: %s reported no tests at all, and an empty run log is not a pass",
			ErrUnrunnable, e.name)
	}

	return log, nil
}

// Mutants asks the command for the mutable targets in one file.
func (e *Exec) Mutants(ctx context.Context, dir, file string) ([]Mutant, error) {
	rel, err := insideProject(file)
	if err != nil {
		return nil, err
	}

	res, err := e.call(ctx, dir, CallMutants, rel)
	if err != nil {
		return nil, err
	}

	mutants := make([]Mutant, 0, len(res.Mutants))
	for _, m := range res.Mutants {
		if _, err := insideProject(m.File); err != nil {
			return nil, fmt.Errorf("%w: %s returned a mutant of %q, which is not a file in the project",
				ErrUnrunnable, e.name, m.File)
		}
		mutants = append(mutants, Mutant{File: m.File, Symbol: m.Symbol, Line: m.Line, Content: m.Content})
	}

	return mutants, nil
}

// durationOf reads the run's own duration. It is a raw number in the protocol
// so that a missing key and a zero are told apart: a run log with no duration
// fails conformance, and quietly reading it as zero would hide that.
func durationOf(raw json.RawMessage) time.Duration {
	if len(raw) == 0 {
		return 0
	}

	var ms float64
	if err := json.Unmarshal(raw, &ms); err != nil {
		return 0
	}

	return time.Duration(ms * float64(time.Millisecond))
}

// call runs one call of the protocol and parses the one object it may print.
func (e *Exec) call(parent context.Context, dir, verb string, args ...string) (response, error) {
	if len(e.command) == 0 {
		return response{}, fmt.Errorf("%w: the %s adapter declares no command to run", ErrUnrunnable, e.name)
	}

	project, err := filepath.Abs(dir)
	if err != nil {
		return response{}, fmt.Errorf("%w: %v", ErrUnrunnable, err)
	}

	ctx, cancel := context.WithTimeout(parent, e.timeout)
	defer cancel()

	argv := append(slices.Clone(e.command[1:]), verb, project)
	argv = append(argv, args...)

	cmd := exec.CommandContext(ctx, e.command[0], argv...)
	cmd.Dir = project

	// The command runs in its own process group, and cancelling kills the
	// group. An adapter that spawned a test runner of its own would otherwise
	// survive its parent, holding the machine and the output pipe after the
	// battery had given up on it.
	inOwnGroup(cmd)
	cmd.Cancel = func() error { return killGroup(cmd) }

	// The cap is enforced as the bytes arrive, and hitting it kills the
	// command. Buffering a runaway stream to the end and complaining afterwards
	// would mean the cap protected nothing.
	out := &capped{limit: e.cap, full: cancel}
	errOut := &capped{limit: stderrCap}
	cmd.Stdout = out
	cmd.Stderr = errOut
	cmd.WaitDelay = waitDelay

	runErr := cmd.Run()

	switch {
	case out.over():
		return response{}, fmt.Errorf("%w: %s printed more than the %d byte output cap and was killed",
			ErrUnrunnable, e.name, e.cap)
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return response{}, fmt.Errorf("%w: %s did not finish %s within %s and was killed",
			ErrUnrunnable, e.name, verb, e.timeout)
	case parent.Err() != nil:
		return response{}, fmt.Errorf("%w: %s was stopped during %s: %v",
			ErrUnrunnable, e.name, verb, parent.Err())
	case runErr != nil:
		return response{}, fmt.Errorf("%w: %s failed %s: %v: %s",
			ErrUnrunnable, e.name, verb, runErr, tail(errOut.String()))
	}

	return parseResponse(e.name, out.Bytes(), errOut.String())
}

// parseResponse reads the one JSON object the protocol allows.
//
// The adapter's stdout is foreign input (D18): it comes from a command the
// project declared, and this tool has no idea what wrote it. So one shape is
// accepted and every other is named and refused — nothing, a list, a second
// object, a schema from another version, a trailing word.
func parseResponse(name string, raw []byte, stderr string) (response, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return response{}, fmt.Errorf("%w: %s printed nothing on stdout: %s",
			ErrUnrunnable, name, tail(stderr))
	}

	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var res response
	if err := dec.Decode(&res); err != nil {
		return response{}, fmt.Errorf("%w: %s did not print one JSON object on stdout: %v",
			ErrUnrunnable, name, err)
	}
	if dec.More() {
		return response{}, fmt.Errorf("%w: %s printed more than one thing on stdout: the protocol is one JSON object and nothing after it",
			ErrUnrunnable, name)
	}
	if res.Schema != ProtocolSchema {
		return response{}, fmt.Errorf("%w: %s printed schema %d, and this tool speaks schema %d",
			ErrUnrunnable, name, res.Schema, ProtocolSchema)
	}

	return res, nil
}

// capped is a writer that stops at a limit and remembers that it did.
//
// The first write past the limit calls full, which is how the runner kills a
// flooding command rather than reading it forever.
type capped struct {
	limit int
	full  func()

	mu      sync.Mutex
	buf     bytes.Buffer
	overrun bool
}

// Write keeps what fits under the limit and drops the rest.
func (c *capped) Write(p []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	room := c.limit - c.buf.Len()
	if room > 0 {
		if room > len(p) {
			room = len(p)
		}
		c.buf.Write(p[:room])
	}

	if len(p) > room && !c.overrun {
		c.overrun = true
		if c.full != nil {
			c.full()
		}
	}

	// The whole write is reported as taken. Returning short would make the
	// copier stop with io.ErrShortWrite, and the error a reader then saw would
	// be about a pipe rather than about the cap.
	return len(p), nil
}

func (c *capped) over() bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.overrun
}

func (c *capped) Bytes() []byte {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.buf.Bytes()
}

func (c *capped) String() string {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.buf.String()
}

// interfaces this file must satisfy.
var (
	_ Adapter   = (*Exec)(nil)
	_ Adapter   = (*Go)(nil)
	_ io.Writer = (*capped)(nil)
)
