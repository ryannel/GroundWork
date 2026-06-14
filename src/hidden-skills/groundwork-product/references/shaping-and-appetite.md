# Shaping and Appetite

We are product engineers before we are coders: the job is to move user outcomes, not to ship tickets. This reference is the per-item view — how to shape one piece of work and set what it is worth. (Choosing and sequencing *across* work is `scope-and-sequencing.md`.)

## Outcomes over outputs

An **output** is a feature shipped, a ticket closed, a migration done. An **outcome** is a change in what a user can do, how fast they can do it, or how reliably the system supports them. Plan around outcomes and let outputs be whatever shape delivers them. A cycle that ends with three closed tickets and no user-visible change is a cycle of failed work. When the conversation drifts toward "what features will we build," pull it back to "what outcome are we moving, and how will we know."

## Shape work before scheduling it

No work enters delivery without being *shaped*: the problem stated in user terms, the rough solution sketched, the boundaries drawn to exclude rabbit holes. Shaped work is expensive upfront and cheap downstream. Unshaped work is the single biggest source of mid-delivery drift, scope creep, and late discovery that the whole approach was wrong. Shaping is deliberately done at the right altitude — concrete enough to be buildable, abstract enough to leave the implementation room.

## Appetite, not estimate

Set an **appetite** first — "this problem is worth about two weeks of one person's attention" — and design the largest good solution that fits inside it. This inverts the usual flow: instead of estimating the cost of a fixed solution, fix the cost and negotiate the solution. The question becomes "what is the best outcome we can deliver in this budget?" not "how long will this take?" Appetite is a statement of how much the problem is worth, set before the solution exists to bias it. If a solution cannot fit the appetite, cut scope or reject the work — do not stretch the appetite to fit the solution.

## Ship the smallest validating increment

The first thing built is the smallest version that validates the riskiest assumption — not the complete feature. Shipping to learn, in the cheapest increment that produces a real signal, beats shipping the polished whole and discovering the premise was wrong. The increment is chosen for what it *teaches*, not for what it completes.

## Instrument everything you ship

A feature that is not measured does not exist from a product point of view. Decide the success signal *before* you ship — the event, the dashboard, the threshold — and check it after release. If it cannot be measured, negotiate the feature until it can. (The signal design itself is `success-metrics-and-signals.md`.)

## Kill your darlings

Deletion is the most under-used tool in the kit. Every feature, doc page, dashboard tile, or flag that does not pay its maintenance cost should be cut. A smaller, sharper product is cheaper to operate and easier for the next engineer — or agent — to understand. A feature not moving an outcome is a candidate for removal, not preservation.

## Antipatterns to catch

- **Velocity-as-KPI.** Story points per cycle measure nothing about user outcomes; optimising for it corrupts the team.
- **Estimate-driven planning.** Anchoring on how long work takes rather than how much it is worth. Use appetites.
- **Build-it-and-they-will-come.** Launching with no measurement plan — a signal that no one owns the outcome.
- **Debt-for-its-own-sake.** Refactors with no user-visible payoff. Wrap the necessary ones inside an outcome that demands them.
- **Scope expanding to fill time.** No fixed appetite, so work grows until a deadline forces a messy unplanned cut.
