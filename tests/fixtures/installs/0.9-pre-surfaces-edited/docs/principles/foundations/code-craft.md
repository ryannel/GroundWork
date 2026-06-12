---
title: Code Craft
description: Simplicity, readability, the discipline of deletion, and the refusal to build for hypothetical futures.
status: active
last_reviewed: 2026-05-26
---
# Code Craft

## TL;DR

Code is read far more than it is written. Our craft is to write code that the next reader — human or agent — can understand, change, and delete with confidence. Simplicity is the default; abstraction is a cost that must be earned.

## Why this matters

In a codebase that is alive for more than a year, the dominant cost is not writing code — it is understanding the code already there so you can change it. Every abstraction, every layer of indirection, every "flexible" interface is a tax on future readers. Our stance is that taxes must be justified. When we optimise for future flexibility we have not yet needed, we pay a certain cost today against an uncertain benefit later; more often than not, the benefit never arrives and we are left with the cost.

## Our principles

### 1. Simpler is better than clever

A function that a tired engineer can understand in thirty seconds is worth more than a function that demonstrates the author's taste in type systems. Prefer plain data structures over clever abstractions, plain control flow over meta-programming, plain naming over in-joke naming. When "clever" and "clear" conflict, clear wins.

### 2. No speculative abstraction

Do not build a generalisation until you have at least three concrete use cases driving the same shape. Premature abstractions are harder to change than the duplication they replace — because now you have to understand the abstraction, the use cases, and the compatibility between them before you can change any of them. Three similar lines of code is almost always better than a half-designed helper.

### 3. Deletion is a virtue

The code you delete cannot break, cannot require maintenance, cannot confuse the next reader, and cannot leak a vulnerability. When a feature is removed, the code should go with it — including the tests, the config flags, and the docs. Leaving dead code "just in case" is a bet that is almost always wrong: if we need it back, we will write a clearer version with the benefit of hindsight.

### 4. Names are the interface

A badly named function is a broken interface even if its behaviour is correct, because every caller has to read the implementation to know what it does. We spend time on names. We rename aggressively when a better name becomes clear. Variables, functions, types, files, directories — all of them communicate, and a mismatch between name and behaviour is a bug.

### 5. Comments explain the "why"

Code explains the "what" — the comment is redundant. Names explain the "who" and "where." The only thing left for a comment is the "why": the non-obvious constraint, the invariant that must hold, the bug that drove an odd choice, the reference to an ADR. If a comment would be obvious to anyone who read the surrounding code, it is noise.

### 6. Error handling is design, not decoration

Errors are a first-class part of the interface, not an afterthought. We decide — explicitly — which errors a function can return, how callers are expected to respond, and where the boundary between recoverable and fatal is. `err != nil` sprinkled through a codebase without a model behind it is a failure of design.

### 7. Trust the boundary; distrust the internal

We validate at system boundaries — user input, external APIs, message payloads — where the data is untrusted. We do not re-validate between internal callers in the same service; if an internal contract is wrong, the right fix is the contract, not a runtime check in every consumer. Defensive programming inside the trust boundary is a form of noise.

### 8. Dead code is a bug

Commented-out code, `_unused` variables, orphan functions, legacy configuration — all of it decays the signal-to-noise ratio of the codebase. When we find it, we delete it. `git` preserves anything we lose; the working tree should contain only code that is alive today.

## How we apply this

- [Hexagonal Architecture](../system-design/hexagonal-architecture.md) — the structural discipline that makes simplicity scalable.
- [Testing](testing.md) — tests that exercise behaviour keep refactoring cheap.
- [Decisions](../../decisions/) — the ADRs that capture the "why" our comments do not.

## Anti-patterns we reject

- **Defensive programming without a threat model.** Guarding every internal call against nil is not robustness — it is distrust of our own type system.
- **"Might need it later" scaffolding.** Config flags for scenarios that do not exist, plugin systems with one plugin, interfaces with one implementation. Delete.
- **Fashion-driven refactors.** Rewriting working code to match a new pattern the team read about this week is debt, not progress.
- **Multi-paragraph docstrings.** If the function needs a multi-paragraph docstring to be understood, the function is wrong. Split it, rename it, or simplify it — then the docstring is not needed.
- **Backwards-compatibility shims for internal APIs.** If it is fully internal, changing it is allowed and expected; compatibility layers are debt we impose on ourselves for no benefit.

## Further reading

- *A Philosophy of Software Design*, John Ousterhout — deep-module principle, the cost of shallow abstractions.
- *Tidy First?*, Kent Beck — the economics of refactoring as a separable activity.
- *The Pragmatic Programmer*, Hunt & Thomas — the canonical treatment of names, duplication, and orthogonality.
