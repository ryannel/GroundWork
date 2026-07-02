---
title: Code Craft
description: Simplicity, readability, the discipline of deletion, and the refusal to build for hypothetical futures.
status: active
last_reviewed: 2026-06-19
---
# Code Craft

## TL;DR

Code is read far more than it is written. Our craft is to write code that the next reader — human or agent — can understand, change, and delete with confidence. Simplicity is the default; abstraction is a cost that must be earned.

## Why this matters

In a codebase that is alive for more than a year, the dominant cost is not writing code — it is understanding the code already there so you can change it. Every abstraction, every layer of indirection, every "flexible" interface is a tax on future readers. Our stance is that taxes must be justified. When we optimise for future flexibility we have not yet needed, we pay a certain cost today against an uncertain benefit later; more often than not, the benefit never arrives and we are left with the cost.

## Our principles

### 1. Simpler is better than clever

A function that a tired engineer can understand in thirty seconds is worth more than a function that demonstrates the author's taste in type systems. Prefer plain data structures over clever abstractions, plain control flow over meta-programming, plain naming over in-joke naming. When "clever" and "clear" conflict, clear wins.

The trap is mistaking *simple* for *familiar*. Rich Hickey's distinction is the one that matters: simple is the opposite of *complex* (one concern, not braided together), while easy is the opposite of *hard* (close at hand, familiar). Cleverness is bad precisely when it complects — when it braids state with time, policy with mechanism, identity with behaviour to buy terseness. But an unfamiliar construct that *untangles* those concerns is not cleverness; it is simplicity wearing a new face, and familiarity will catch up. The decision rule: prefer the option with the fewest interleaved concerns, even when it is the less familiar one — and reject the option that is compact only because it has tangled things you will later need to pull apart.

### 2. No speculative abstraction

Do not build a generalisation until you have at least three concrete use cases driving the same shape. Premature abstractions are harder to change than the duplication they replace — because now you have to understand the abstraction, the use cases, and the compatibility between them before you can change any of them.

The asymmetry is the whole argument, and Sandi Metz states it best: duplication is far cheaper than the wrong abstraction. Unwinding a wrong abstraction means re-inlining it into every caller and then deleting what each one does not need — strictly more work than the duplication you were trying to avoid, often done under deadline by someone who did not write it. When you are unsure, duplicate: you can always extract later with more information, but you cannot cheaply un-extract.

DRY is a rule about knowledge, not characters. Two fragments that look identical but change for different reasons are *not* duplication, and coupling them is the mistake; one business rule expressed in two places *is* duplication even when the code differs. The decision rule: extract only when you have seen the same shape change for the same reason three times, or you have a hard, already-funded requirement (not a guess) for the second case. Until then, keep the copies and watch them — if they drift apart, they were never the same thing; if they move together, you have found the real abstraction and earned the right to name it.

### 3. Deletion is a virtue

The code you delete cannot break, cannot require maintenance, cannot confuse the next reader, and cannot leak a vulnerability. When a feature is removed, the code should go with it — including the tests, the config flags, and the docs. Leaving dead code "just in case" is a bet that is almost always wrong: if we need it back, we will write a clearer version with the benefit of hindsight.

### 4. Names are the interface

A badly named function is a broken interface even if its behaviour is correct, because every caller has to read the implementation to know what it does. We spend time on names. We rename aggressively when a better name becomes clear. Variables, functions, types, files, directories — all of them communicate, and a mismatch between name and behaviour is a bug.

### 5. Comments explain the "why"

Code explains the "what" of its own mechanics; restating that in prose is noise. The comment's job is the "why" — the non-obvious constraint, the invariant that must hold, the bug that drove an odd choice, the reference to an ADR. If a comment would be obvious to anyone who read the next two lines, delete it.

There is one "what" worth writing, and it is not redundant: the comment that states what a unit *does, assumes, and costs* so that a caller never has to read its body. That comment is the abstraction. John Ousterhout's point holds — "good code is self-documenting" is the excuse that produces a hundred shallow methods nobody can compose, because if a caller must read your implementation to use it, you have no abstraction at all. The decision rule splits cleanly by location: comment the *contract* at the boundary of a module (what it guarantees, what it requires, what it will cost you); do not narrate the line-by-line mechanics *inside* it. A comment that saves a reader from opening the file is leverage; a comment that repeats the line beneath it is debt.

### 6. Error handling is design, not decoration

Errors are a first-class part of the interface, not an afterthought. We decide — explicitly — which errors a function can return, how callers are expected to respond, and where the boundary between recoverable and fatal is. `err != nil` sprinkled through a codebase without a model behind it is a failure of design.

Make the failure modes visible in the signature. Model expected, recoverable failures as values in the return type (Go's `error` return, Rust's `Result`) so a caller cannot forget that they exist; reserve exceptions and panics for programmer error and states you genuinely cannot continue from. Wrap foreign errors at the boundary where you cross into another system's vocabulary, so a third party's failure taxonomy does not leak into yours. The test of a good error design is simple: from the signature alone, a caller can tell what can go wrong and what they are expected to do about it.

### 7. Trust the boundary; distrust the internal

We validate at system boundaries — user input, external APIs, message payloads — where the data is untrusted. We do not re-validate between internal callers in the same service; if an internal contract is wrong, the right fix is the contract, not a runtime check in every consumer. Defensive programming inside the trust boundary is a form of noise.

The mechanism that makes this safe is *parsing*, not checking. At the boundary, turn untrusted input into a type that cannot represent the illegal state — a parsed `Email` or `NonEmptyList<Order>`, not a raw string you re-inspect everywhere (Alexis King, "Parse, don't validate"). Once the data carries its guarantee in its type, internal code receives it for free and re-validation is genuinely dead code. If you find yourself re-checking a value deep inside the system, that is the signal: the boundary handed you a type too weak to trust, so strengthen the type rather than scattering the check.

The honest exception is the security boundary that runs *inside* the process — a multi-tenant query, an authorization decision, a privilege-escalation path. There, defense in depth is not noise: the second check guards against a different failure mode (a bug, not malformed input), and the cost of being wrong is a breach rather than a stack trace. Distrust the internal everywhere except where the threat model says a single point of failure is itself the vulnerability.

### 8. Dead code is a bug

Commented-out code, `_unused` variables, orphan functions, legacy configuration — all of it decays the signal-to-noise ratio of the codebase. When we find it, we delete it. `git` preserves anything we lose; the working tree should contain only code that is alive today.

## How we apply this

- [How We Structure Code](../system-design/code-structure.md) — the structural discipline that makes simplicity scalable.
- [Testing](testing.md) — tests that exercise behaviour keep refactoring cheap.
- [Decisions](../system-design/architecture-decisions.md) — the ADRs that capture the "why" our comments do not.

## Anti-patterns we reject

- **Defensive programming without a threat model.** Guarding every internal call against nil is not robustness — it is distrust of our own type system.
- **"Might need it later" scaffolding.** Config flags for scenarios that do not exist, plugin systems with one plugin, interfaces with one implementation. Delete.
- **Fashion-driven refactors.** Rewriting working code to match a new pattern the team read about this week is debt, not progress.
- **Multi-paragraph docstrings.** If the function needs a multi-paragraph docstring to be understood, the function is wrong. Split it, rename it, or simplify it — then the docstring is not needed.
- **Backwards-compatibility shims for internal APIs.** If it is fully internal, changing it is allowed and expected; compatibility layers are debt we impose on ourselves for no benefit.

## Further reading

- *A Philosophy of Software Design*, John Ousterhout — deep modules, the cost of shallow abstractions, and why interface comments are part of the design, not decoration.
- *The Wrong Abstraction*, Sandi Metz — why duplication is far cheaper than the wrong abstraction, and how to unwind one.
- *Parse, Don't Validate*, Alexis King — pushing validation to the boundary by making illegal states unrepresentable in the type.
- *Simple Made Easy*, Rich Hickey — simple is not easy; complexity is entanglement, not volume.
- *Tidy First?*, Kent Beck — the economics of refactoring as a separable activity.
- *The Pragmatic Programmer*, Hunt & Thomas — the canonical treatment of names, duplication, and orthogonality.
