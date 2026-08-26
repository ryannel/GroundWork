package seal

import (
	"fmt"

	"github.com/ryannel/groundwork/internal/journal"
)

// Amendment is one seal to move, as the caller asks for it.
type Amendment struct {
	Kind    string
	Subject string

	// Paths are what the seal covers after the move, from the repo root. They
	// replace the old list whole: a seal says what it covers, not what changed.
	Paths []string

	// Reason is why the seal moved. It is required.
	Reason string
}

// Amended is one seal that was moved.
type Amended struct {
	Tag string

	// Before and After are what the tag held and what it holds now. The verb
	// prints both, because a seal that moved with nobody shown what changed is
	// a seal that moved quietly.
	Before Granted
	After  Granted

	Reason string

	// Signature is what the amended tag's signature came to, and Signer is who
	// git says signed it. Both are the record R6 asks for: an unsigned
	// amendment reads as agent-recorded, never owner-approved.
	Signature Signature
	Signer    string

	// Note says in words what the signature state means for this amendment.
	Note string
}

// AmendSeal moves one seal in the repo at repoDir.
//
// R6's shape: read the before, refuse without a reason, write the revoked line
// while the old tag still stands, move the tag, file the tag it replaced in the
// mirror, write the granted line.
//
// A move is two lines, revoked then granted, per D13. The revoked line goes
// first so neither line names a commit the tag never held.
//
// Machinery cannot enforce that the owner asked for this. An agent typing a
// reason is not the owner speaking. So the record states who signed, and an
// unsigned amendment is agent-recorded and nothing more.
func AmendSeal(repoDir string, a Amendment) (Amended, error) {
	dir, err := root(repoDir)
	if err != nil {
		return Amended{}, err
	}

	if a.Reason == "" {
		return Amended{}, fmt.Errorf("a seal moves with a reason, and no reason was given")
	}
	if err := journalTextFits("reason", a.Reason); err != nil {
		return Amended{}, err
	}

	tag, err := TagName(a.Kind, a.Subject)
	if err != nil {
		return Amended{}, err
	}

	was, err := resolve(dir, "refs/tags/"+tag)
	if err != nil {
		return Amended{}, err
	}
	if was == "" {
		return Amended{}, fmt.Errorf(
			"%s is not granted, and a seal is made with groundwork seal grant", tag)
	}

	before, raw, err := standingSeal(dir, tag)
	if err != nil {
		return Amended{}, err
	}

	battery, run, err := batteryFor(dir)
	if err != nil {
		return Amended{}, err
	}

	covered, err := coveredAt(dir, a.Paths)
	if err != nil {
		return Amended{}, err
	}

	target, err := resolve(dir, "HEAD^{commit}")
	if err != nil {
		return Amended{}, err
	}

	message, err := Message{
		Kind: a.Kind, Subject: a.Subject, Covered: covered,
		Battery: battery, BatteryRun: run,
	}.Render()
	if err != nil {
		return Amended{}, err
	}

	// An amendment writes to the mirror exactly as a grant does, so the same
	// rule applies: new work onto a branch somebody has scribbled on stops
	// until a person has looked at it. Asked before anything moves (F69).
	if err := checkMirrorIsClean(dir); err != nil {
		return Amended{}, err
	}

	// The revoked line goes first, while the tag still holds what it held. A
	// line written after the move would name the new commit and say the old
	// seal was revoked at it, which the tag never said.
	wasSigned, wasSigner := signatureOf(dir, tag)

	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: a.Kind, Tag: tag, Action: "revoked",
		Battery: battery, BatteryRun: run, Reason: a.Reason,
		Signature: string(wasSigned), Signer: wasSigner,
	}); err != nil {
		return Amended{}, err
	}

	if err := writeTag(dir, tag, message, true); err != nil {
		return Amended{}, err
	}

	if err := mirrorWith(dir, tag, map[string]string{was: raw}); err != nil {
		return Amended{}, fmt.Errorf("%s moved, and the mirror did not take it: %w", tag, err)
	}

	signature, signer := signatureOf(dir, tag)

	if _, err := journal.WriteSeal(dir, journal.Seal{
		Kind: a.Kind, Tag: tag, Action: "granted",
		Battery: battery, BatteryRun: run, Reason: a.Reason,
		Signature: string(signature), Signer: signer,
	}); err != nil {
		return Amended{}, fmt.Errorf("%s moved, and the journal did not take it: %w", tag, err)
	}

	after := Granted{
		Tag: tag, Target: target, Covered: covered,
		Battery: battery, BatteryRun: run, Signature: signature,
	}

	return Amended{
		Tag: tag, Before: before, After: after, Reason: a.Reason,
		Signature: signature, Signer: signer,
		Note: amendmentNote(signature, signer),
	}, nil
}

// standingSeal reads what a tag holds now, and its own bytes.
//
// The bytes are what the mirror files as the prior target. The tag object that
// was there is the only evidence of what the seal used to cover.
func standingSeal(dir, tag string) (Granted, string, error) {
	raw, err := rawTag(dir, tag)
	if err != nil {
		return Granted{}, "", err
	}

	message, _ := splitTag(raw)

	m, err := ParseMessage(message)
	if err != nil {
		return Granted{}, "", fmt.Errorf("%s does not read as a seal, so there is no before to print: %w",
			clip(tag), err)
	}

	target, err := resolve(dir, "refs/tags/"+tag+"^{commit}")
	if err != nil {
		return Granted{}, "", err
	}

	signature, _ := signatureOf(dir, tag)

	return Granted{
		Tag: tag, Target: target, Covered: m.Covered,
		Battery: m.Battery, BatteryRun: m.BatteryRun, Signature: signature,
	}, raw, nil
}

// signatureOf says what one tag's signature came to right now.
func signatureOf(dir, tag string) (Signature, string) {
	raw, err := rawTag(dir, tag)
	if err != nil {
		return Unsigned, ""
	}

	_, signature := splitTag(raw)

	keys, put, err := openSigners(dir)
	if err != nil {
		return Unsigned, ""
	}
	defer put()

	state, signer, _ := checkSignature(dir, tag, signature, keys)

	return state, signer
}

// amendmentNote says in words what the amended tag's signature means.
//
// R6: an unsigned amendment reads as agent-recorded, never owner-approved. The
// word approved appears nowhere in the unsigned wording, because a reader
// skimming for it would otherwise find it.
func amendmentNote(signature Signature, signer string) string {
	if signature != Verified {
		return "recorded by an agent: the amended tag is " + string(signature) +
			", so this is not the owner's own word"
	}

	if signer == "" {
		return "signed by a key the allowed-signers file lists"
	}

	return "signed by " + signer
}

// journalTextFits refuses text the journal will not record, before anything is
// written. A reason that lands here after the tag moved would leave a seal
// moved with no line saying why.
func journalTextFits(name, text string) error {
	if len(text) > journal.MaxTextBytes {
		return fmt.Errorf("the %s is %d bytes, over the journal's limit of %d",
			name, len(text), journal.MaxTextBytes)
	}

	return nil
}
