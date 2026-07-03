# UI Design — the CLI surface

The only surface is the command line. Three commands, human-readable output.

## `taskcli add "<title>"`

Captures a task. Prints a one-line confirmation naming the assigned id:

```
$ taskcli add "Buy milk"
Added #1: Buy milk
```

## `taskcli list`

Prints every captured task, one per line, in the order they were added. Each
line is **checkbox-prefixed** so completion state is visible at a glance:

```
$ taskcli list
[ ] #1 Buy milk
[ ] #2 Ship the bet
```

`[ ]` is an open task; `[x]` is a completed one (milestone 2). An empty store
prints nothing and exits 0.

## `taskcli done <id>` (milestone 2)

Marks a task complete, then confirms:

```
$ taskcli done 1
Completed #1
$ taskcli list
[x] #1 Buy milk
[ ] #2 Ship the bet
```

Completion is shown by flipping the checkbox from `[ ]` to `[x]` on that task's
line — the same list format, no other visual change.

## Errors

An unknown command or a `done` on a missing id prints a short message to stderr
and exits non-zero. No stack traces reach the user.
