//go:build !unix

package adapter

import "os/exec"

// inOwnGroup does nothing where process groups are not what this platform
// offers. The timeout still kills the command itself.
func inOwnGroup(*exec.Cmd) {}

// killGroup kills the command.
func killGroup(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}

	return cmd.Process.Kill()
}
