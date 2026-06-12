# Phase 3: Service Design

Decide how the system is divided into services and what each one owns. This decision determines deployment independence, operational complexity, and every integration contract downstream. Getting the boundaries wrong is expensive to undo.

The goal is right-sized services — few enough to avoid distributed systems overhead, well-defined enough that each can be deployed and scaled independently. Splitting too finely creates operational noise for no benefit. Splitting too coarsely forces incompatible workloads into a single deployment.

A service boundary is justified when multiple signals converge: the language and mental model shift, the runtime or scaling profile is incompatible with the rest, or the deployment cadence is fundamentally different. One signal alone is rarely enough.

**How to run this conversation:**

Start by sharing your current read of the system from the existing documents. Then explore with the user where the natural fault lines are — where the work feels different, where the technology or scaling needs diverge.

Propose the service map in text form: for each service, what it owns, why the boundary sits where it does, and a name following modern service naming conventions. Confirm before moving on.
