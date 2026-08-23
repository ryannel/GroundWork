package journal

// A drive line is the human's own evidence that they ran the product
// (proof.md): "The acceptance seal requires evidence that you actually drove
// the product. It is recorded after the work's last commit, so it cannot be a
// stale run."
//
// The line carries the person's notes. What makes it evidence is the envelope
// it rides in: the commit that was HEAD when it was written, and the session
// that wrote it. Neither is a field the caller fills, so a drive cannot claim a
// commit it was not recorded at.
//
// Whether a drive is fresh enough for a seal is not judged here. That is the
// seal machinery's question, and it reads these lines to answer it.

// Drive is one drive of the product, as the person reports it.
type Drive struct {
	// Notes are what they did and what they saw.
	Notes string
}

// driveEvent is one drive line.
type driveEvent struct {
	envelope

	Notes string `json:"notes"`
}

// WriteDrive records one drive in the journal of the repo at repoDir. It
// returns the path the event was stored at.
//
// It writes nothing when it rejects the drive. Notes are required: a drive
// artifact with nothing written on it is the button-click the spec says
// acceptance must not decay into.
func WriteDrive(repoDir string, d Drive) (string, error) {
	if err := checkFilled("notes", d.Notes); err != nil {
		return "", err
	}

	return write(repoDir, "drive", func(dir, tip string, env envelope) (any, error) {
		return driveEvent{envelope: env, Notes: d.Notes}, nil
	})
}
