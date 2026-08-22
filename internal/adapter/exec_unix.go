//go:build unix

package adapter

import (
	"os/exec"
	"syscall"
)

// inOwnGroup puts the command in a process group of its own, so that killing
// it kills whatever it started.
func inOwnGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// killGroup kills the command's whole process group.
//
// The negative pid is what makes it the group rather than the one process. A
// group that has already gone is not an error: the caller wanted it dead, and
// it is.
func killGroup(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}

	if err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL); err != nil {
		// The group may have exited between the check and the signal, and on
		// some systems the group is gone while the process is not. Killing the
		// one process is the fallback.
		return cmd.Process.Kill()
	}

	return nil
}
