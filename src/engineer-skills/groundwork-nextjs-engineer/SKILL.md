---
name: groundwork-nextjs-engineer
description: >
  Implement, review, and refactor Next.js applications using canonical
  app docs, Next.js App Router boundaries, React Server Components, Server
  Actions, Zod schemas, accessibility, and the project's visual system. Use for
  work touching components, hooks, lib, styling, routing, forms, data
  fetching, tests, real-time UI, modals, error boundaries, Tailwind,
  theming, or frontend architecture. Make sure to use this skill whenever a
  user is working on a Next.js codebase, building UI features, fixing
  frontend bugs, or reviewing React/Next.js code.
---

# Next.js Engineer

Frontend execution engineer for Next.js applications. This skill guides implementation within the Next.js App Router architecture — server-first rendering, type-safe data boundaries, accessible UI, and a cohesive visual system.

## Operating Rules

1. Locate the architectural layer before editing. Server Components, Client Components, Server Actions, hooks, and lib modules each have distinct responsibilities.
2. The capability core owns business logic. The web surface is wired to it through typed fetchers and Server Actions at validated data boundaries — never re-implement a rule the core's contract already proves.
3. Route durable frontend policy to the canonical docs (`docs/principles/stack/typescript/frontend.md`) instead of duplicating it in code comments or this skill.
4. Verify types, accessibility, theme behavior, and data-fetching boundaries before declaring work complete.

## Code intelligence (repo map + Serena)

Orient before reading widely: `.groundwork/skills/code-intelligence.md` covers the repo map (hub-finding by centrality) and Serena (LSP-backed symbol navigation and edits) in full, including degraded mode. TypeScript's compiler already catches a missed call site, so treat `find_referencing_symbols` as a blast-radius and navigation win, not a correctness gate.

## Core Pillars

1. **Server-First Rendering** — Server Components are the default. They reduce client bundle size, eliminate waterfall fetches, and keep sensitive logic server-side. Only reach for `"use client"` when the component genuinely needs browser APIs, user interaction state, or event handlers. This boundary decision is the most impactful architectural choice in the app.

2. **Type-Safe Data Boundaries** — Data flows through explicit, validated boundaries. Server Actions use Zod schemas for input validation. API responses are typed end-to-end. Runtime data never crosses a trust boundary without validation. This catches integration bugs at the boundary rather than deep in component trees.

3. **Accessible by Default** — Accessibility is a design constraint, not a post-hoc audit. Semantic HTML, ARIA attributes, keyboard navigation, focus management, color contrast, and screen reader testing are part of every feature, not a separate checklist. Inaccessible UI is a bug.

4. **Cohesive Visual System** — Every visual value is owned by the design system, not this skill. `docs/design-system.md` is the human source of truth; `.groundwork/config/brand-tokens.json` is its machine projection; the generator projects both into `app/brand.css` and the token utilities + surface classes (`.surface-glass/.surface-elevated/.surface-hero`) in `app/globals.css`. Colour, type, spacing, elevation, blur, gradients, surfaces, and motion are consumed through those tokens — read values from the design system, never invent them. A hardcoded literal bypasses the system, fails the token-conformance lint, and is visual debt.

5. **Optimistic, Resilient UI** — Mutations use optimistic updates with proper rollback. Error boundaries catch failures gracefully. Loading states are intentional, not afterthoughts. The UI should feel responsive even when the network isn't.

## How to Use This Skill

**Orient first** — see Code intelligence above; it is the first step, not optional. Then match the user's task to the smallest relevant reference set. Most tasks touch one or two references.

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Version Corrections | `references/version-corrections.md` | Writing any Next.js API the model may know a stale shape for — async `params`/`searchParams`, `proxy.ts`, `'use cache'`, navigation-throw gotchas, hydration causes. Check this first on any App Router task. |
| Architecture & Layers | `references/architecture.md` | Understanding the app's architectural layers, file organization, or module boundaries. |
| Server Components | `references/server-components.md` | Deciding server vs client boundary, understanding RSC patterns, streaming. |
| Data Fetching | `references/data-fetching.md` | Fetching data in server components, SWR patterns, cache invalidation. |
| Mutations & Forms | `references/mutations-and-forms.md` | Server Actions, form validation with Zod, optimistic updates, error handling. |
| Routing & Navigation | `references/routing-and-navigation.md` | App Router conventions, layouts, parallel routes, intercepting routes, modals. |
| Error Boundaries | `references/error-boundaries.md` | Error handling UI, fallback components, recovery patterns. |
| Type System | `references/type-system.md` | TypeScript patterns, Zod schemas, shared types, type narrowing. |
| Tailwind & Styling | `references/tailwind-and-styling.md` | Tailwind v4 mechanics, consuming projected tokens, theming, dark mode, responsive design. |
| Visual Language | `references/visual-language.md` | Consuming the design system: colour/type/spacing/elevation/surface technique and the projected token + surface utilities. |
| UX Principles | `references/ux-principles.md` | Interaction patterns, progressive disclosure, feedback, empty states. |
| Accessibility | `references/accessibility.md` | Semantic HTML, ARIA discipline, keyboard/focus, WCAG AA contrast, accessible forms, `jest-axe`. |
| Security | `references/security.md` | XSS, CSRF, auth/session, the `NEXT_PUBLIC` secret boundary, Server Action validation, CSP, SSRF on server fetches. |
| Observability | `references/observability.md` | Server spans via `instrumentation.ts`, client Web Vitals/RUM, error reporting, PII discipline. |
| Testing | `references/testing.md` | Component tests, integration tests, accessibility testing, test utilities. |
| Performance | `references/performance.md` | Image/font optimisation, bundling issues, third-party scripts, bundle analysis. |
| Documentation | `references/documentation.md` | Component documentation, Storybook patterns, inline docs. |

## Task Routing

- **Data fetching or mutations** → Load `references/data-fetching.md` and `references/mutations-and-forms.md`. Verify the server/client boundary.
- **UI/design work** → Load `references/visual-language.md` and `references/ux-principles.md`. Check design tokens for colors and spacing.
- **Routing/modal work** → Load `references/routing-and-navigation.md` and `references/architecture.md`. Check existing route conventions.
- **Real-time UI** → Load `references/data-fetching.md` for streaming and revalidation patterns and `references/server-components.md` for the streaming boundary.
- **Form work** → Load `references/mutations-and-forms.md`. Verify Zod schema patterns.
- **Styling/theming** → Load `references/tailwind-and-styling.md` and `references/visual-language.md`. Check design guide.
- **Performance issues** → Load `references/performance.md`. Profile before optimizing.
- **Any App Router API call** → Check `references/version-corrections.md` first; training data is frequently stale on Next.js 15/16 signatures.
- **Any user-input handling — a Server Action or Route Handler parsing a body, query, or upload; a redirect target or outbound fetch URL derived from input; auth/session work** → Load `references/security.md`. Check the server/client boundary and the `NEXT_PUBLIC` secret line.
- **Instrumentation / telemetry** → Load `references/observability.md`. Distinguish server spans from client RUM.
- **AI/LLM feature work** → The model call runs in a Server Action or Route Handler — provider keys never cross the `NEXT_PUBLIC` line. The doctrine (prompts-as-code, evals-as-CI-tests, output validation, moderation gates) is `docs/principles/ai-native/ai-engineering.md`.

## Safety Gates

- Do not use `useEffect` for data fetching — this is an App Router codebase with server-side data fetching. Verify against current patterns in the codebase before introducing fetch-in-effect.
- Do not introduce hardcoded visual literals (colour, spacing, type, shadow, blur, gradient). Read values from `docs/design-system.md` / `.groundwork/config/brand-tokens.json` and consume token utilities or surface classes — arbitrary literals fail the token-conformance lint.
- Do not invent framework versions or API assumptions; verify `package.json`.
- Do not add `"use client"` to a component without confirming it needs browser APIs or interactive state.
- Run typecheck, lint, and the app's tests where the toolchain is available; report a tier as skipped-with-reason (never silently green) where it is not.

## Hallucination Controls

Before presenting frontend guidance as factual:

- Check `package.json` for framework versions and available dependencies.
- Check existing components for naming conventions, file structure, and patterns before proposing new ones.
- Load `docs/design-system.md` and `.groundwork/config/brand-tokens.json` for colour, type, spacing, elevation, and motion values before any visual work — never recall or invent them.
- Check the app's route structure before inventing new route paths or layouts.
- Label any recommendation based on general Next.js knowledge (rather than project-specific patterns) as an inference.

## Output Expectations

- Component changes include the server/client boundary decision and its justification.
- UI changes reference specific design tokens or explain why a custom value is needed.
- New features include accessibility considerations (keyboard nav, ARIA, screen reader behavior).
- Verification steps include specific test commands and visual checks to perform.
- Recommendations distinguish between project conventions and general React/Next.js practices.

## Antipatterns

Reject these patterns:

- **Client Component by default** — Adding `"use client"` out of habit rather than necessity. Server Components are the default for a reason.
- **Fetch-in-useEffect** — Client-side data fetching when server-side fetching would eliminate the loading waterfall and reduce bundle size.
- **Hardcoded visual values** — Magic numbers or literal recipes for colour, spacing, typography, shadow, blur, or gradient that bypass the projected token system.
- **Untyped form data** — Processing form submissions without Zod validation at the Server Action boundary.
- **Accessibility bolted on** — Treating a11y as a separate pass instead of building it into the component from the start.
- **God components** — Components that mix data fetching, business logic, and presentation instead of composing smaller, focused pieces.
