---
title: Frontend
description: React 19, Server Components, SWR, Tailwind, and the design language of a Next.js application.
status: active
last_reviewed: 2026-05-26
---
# Frontend

## TL;DR

The frontend is Next.js 16 with React 19 Server Components, SWR for client-side data, and Tailwind for styling. We render on the server by default, hydrate the minimum needed for interactivity, and keep data-fetching at the leaves. The design language is consistent, calm, and accessible first.

## Why this matters

Frontend engineering in 2026 is no longer a "client-side" discipline. Most pixels are rendered on the server before they reach the browser, and the browser's job is to stay responsive to the user's input rather than to fetch data on their behalf. Getting this split right — what runs on the server, what runs on the client, what streams in between — is the single biggest determinant of how fast and how reliable the app feels. It is also where most frontend bugs live.

## Our principles

### 1. Server components are the default

Every component starts as a Server Component. We add `"use client"` only when we need state, events, or browser-only APIs. The economic argument is simple: every client component costs download, parse, hydrate, and memory on every user's device. Server components cost none of that. The ratio of server-to-client components is tracked and kept high.

### 2. Data fetches at the leaves, not the root

Data fetching happens in the component that actually renders the data, not in a page-level fetcher that passes everything down through props. This lets Suspense boundaries stream exactly as deep as they need to, and it keeps prop-drilling in check. The exception is when two leaves need the same data — then we fetch once in a common ancestor and share via React's built-in request deduplication.

### 3. SWR for client-interactive state

For state that must respond to user interaction in real time — live views, session state, optimistic updates — we use SWR. One cache, one invalidation story, one mental model. We do not mix query libraries in the same app.

### 4. Styling is Tailwind utilities, composed

We style with Tailwind utility classes. When a composition of utilities gets long or is repeated, we extract a component — not a custom CSS class. Component extraction keeps the `className` strings honest; new CSS classes are where design systems go to die of untracked one-offs.

### 5. The design system is a library, not a guideline

Buttons, inputs, modals, tooltips — every primitive is a typed, reviewed component in the shared component library. Ad-hoc styling of a button in a feature folder is a smell; the fix is to add the variant to the library, not to reimplement it.

### 6. Accessibility is a baseline, not a feature

Every interactive component supports keyboard navigation, is screen-reader labelled, and meets WCAG 2.2 AA contrast at minimum. Accessibility failures block merges the same way type errors do. The golden path for every new UI begins with "can I get to it, use it, and understand it with just the keyboard and a screen reader?"

### 7. Client state is recoverable

We do not store state in React that cannot be rebuilt from the server or the URL. Refreshing the page is the end-to-end test of this: if the user loses context after a refresh, we are holding state we should not. The URL is a first-class state container; so are Server Components.

### 8. Performance budgets are enforced in CI

Largest Contentful Paint, Interaction-to-Next-Paint, JS bundle size — all tracked in CI with budgets. A PR that regresses a budget requires an explicit waiver. Performance is never negotiated after the fact; it is designed in.

## Anti-patterns we reject

- **`useEffect` for data fetching.** `useEffect` is an escape hatch for non-React systems; it is not a data-fetching primitive. Use Server Components or SWR.
- **Context for everything.** React Context is a tool for genuinely app-wide concerns (theme, auth, locale). Using it to avoid prop-drilling on three levels is overreach.
- **CSS Modules alongside Tailwind.** One styling system. Not three.
- **Ad-hoc design primitives.** Every new button variant is a tax on the design system. If it needs a variant, add it to the library.
- **State that cannot survive refresh.** Modals that disappear on refresh lose user context; counters that reset on refresh are not counters.
- **"Fix it in a later PR" accessibility.** The later PR will not happen. Ship accessible or ship later.

## Further reading

- *React documentation* ([react.dev](https://react.dev)) — the canonical source for the Server Component mental model.
- *Patterns.dev*, Lydia Hallie & Addy Osmani — a clean survey of modern frontend patterns.
- *Inclusive Components*, Heydon Pickering — the pattern language of accessible component design.
- *Refactoring UI*, Schoger & Wathan — the design vocabulary that informs how we compose Tailwind.
