# gw-<id> — <one-line imperative title>

<Two or three sentences of context: what changed in the framework, and why a project
that predates the change is now misaligned. Write for the agent executing the brief in
the user's project — it has the project in front of it, not this repo.>

## Detect

- **Applies** when <filesystem/content conditions that mean the migration is owed>.
- **Already done** when <how to recognize a project that already made the change,
  including manual half-migrations>.
- **N/A** when <conditions under which the migration is irrelevant — be explicit;
  silence here forces the agent to guess>.

## Transform

<The change as intent and invariants, not a script. Name the files to touch and the
files to leave alone. When an existing skill owns the procedure, delegate — point at
its instruction file rather than restating steps that will drift.>

**Invariant:** <the property that must hold after the transform — the line the agent
checks itself against before committing.>

## Accept

- <What a correct end state looks like, verifiable by inspection or a command.>
- <What must be untouched.>
- One commit, referencing `gw-<id>`.
