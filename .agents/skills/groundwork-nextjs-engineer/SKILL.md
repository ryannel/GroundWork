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

## Operating Contract

1. Locate the architectural layer before editing. Server Components, Client Components, Server Actions, hooks, and lib modules each have distinct responsibilities.
2. The capability core owns business logic. The web surface is wired to it through typed fetchers and Server Actions at validated data boundaries — never re-implement a rule the core's contract already proves.
3. Prefer Server Components by default. Client Components are for state, events, or browser APIs — not just convenience.
4. Route durable frontend policy to the canonical docs (`docs/principles/stack/typescript/frontend.md`) instead of duplicating it in code comments or this skill.
5. Verify types, accessibility, theme behavior, and data-fetching boundaries before declaring work complete.

## Core Pillars

1. **Server-First Rendering** — Server Components are the default. They reduce client bundle size, eliminate waterfall fetches, and keep sensitive logic server-side. Only reach for `"use client"` when the component genuinely needs browser APIs, user interaction state, or event handlers. This boundary decision is the most impactful architectural choice in the app.

2. **Type-Safe Data Boundaries** — Data flows through explicit, validated boundaries. Server Actions use Zod schemas for input validation. API responses are typed end-to-end. Runtime data never crosses a trust boundary without validation. This catches integration bugs at the boundary rather than deep in component trees.

3. **Accessible by Default** — Accessibility is a design constraint, not a post-hoc audit. Semantic HTML, ARIA attributes, keyboard navigation, focus management, color contrast, and screen reader testing are part of every feature, not a separate checklist. Inaccessible UI is a bug.

4. **Cohesive Visual System** — The project uses a design token system projected through Tailwind CSS. Colors, spacing, typography, and elevation follow the project's design guide. Hardcoded values bypass the system and create visual debt. Every visual decision traces back to a design token or an explicit deviation.

5. **Optimistic, Resilient UI** — Mutations use optimistic updates with proper rollback. Error boundaries catch failures gracefully. Loading states are intentional, not afterthoughts. The UI should feel responsive even when the network isn't.

## How to Use This Skill

Match the user's task to the smallest relevant reference set. Most tasks touch one or two references.

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Architecture & Layers | `references/architecture.md` | Understanding the app's architectural layers, file organization, or module boundaries. |
| Server Components | `references/server-components.md` | Deciding server vs client boundary, understanding RSC patterns, streaming. |
| Data Fetching | `references/data-fetching.md` | Fetching data in server components, SWR patterns, cache invalidation. |
| Mutations & Forms | `references/mutations-and-forms.md` | Server Actions, form validation with Zod, optimistic updates, error handling. |
| Routing & Navigation | `references/routing-and-navigation.md` | App Router conventions, layouts, parallel routes, intercepting routes, modals. |
| Error Boundaries | `references/error-boundaries.md` | Error handling UI, fallback components, recovery patterns. |
| Type System | `references/type-system.md` | TypeScript patterns, Zod schemas, shared types, type narrowing. |
| Tailwind & Styling | `references/tailwind-and-styling.md` | Design tokens, Tailwind CSS usage, theming, responsive design, dark mode. |
| Visual Language | `references/visual-language.md` | Color system, typography, spacing grid, elevation, surface dynamics. |
| UX Principles | `references/ux-principles.md` | Interaction patterns, progressive disclosure, feedback, empty states. |
| Testing | `references/testing.md` | Component tests, integration tests, accessibility testing, test utilities. |
| Performance & Deployment | `references/performance-and-deployment.md` | Bundle analysis, lazy loading, image optimization, build configuration. |
| Documentation | `references/documentation.md` | Component documentation, Storybook patterns, inline docs. |

## Task Routing

- **Data fetching or mutations** → Load `references/data-fetching.md` and `references/mutations-and-forms.md`. Verify the server/client boundary.
- **UI/design work** → Load `references/visual-language.md` and `references/ux-principles.md`. Check design tokens for colors and spacing.
- **Routing/modal work** → Load `references/routing-and-navigation.md` and `references/architecture.md`. Check existing route conventions.
- **Real-time UI** → Load `references/data-fetching.md` for streaming and revalidation patterns and `references/server-components.md` for the streaming boundary.
- **Form work** → Load `references/mutations-and-forms.md`. Verify Zod schema patterns.
- **Styling/theming** → Load `references/tailwind-and-styling.md` and `references/visual-language.md`. Check design guide.
- **Performance issues** → Load `references/performance-and-deployment.md`. Profile before optimizing.

## Safety Gates

- Do not use `useEffect` for data fetching — this is an App Router codebase with server-side data fetching. Verify against current patterns in the codebase before introducing fetch-in-effect.
- Do not introduce hardcoded colors, spacing, or font sizes. Check the design guide or design tokens.
- Do not invent framework versions or API assumptions; verify `package.json`.
- Do not add `"use client"` to a component without confirming it needs browser APIs or interactive state.
- Run typecheck, lint, and the app's tests where the toolchain is available; report a tier as skipped-with-reason (never silently green) where it is not.

## Hallucination Controls

Before presenting frontend guidance as factual:

- Check `package.json` for framework versions and available dependencies.
- Check existing components for naming conventions, file structure, and patterns before proposing new ones.
- Check the design guide or configuration for color values, spacing scale, and typography before recommending visual changes.
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
- **Hardcoded visual values** — Magic numbers for colors, spacing, or typography that bypass the design token system.
- **Untyped form data** — Processing form submissions without Zod validation at the Server Action boundary.
- **Accessibility bolted on** — Treating a11y as a separate pass instead of building it into the component from the start.
- **God components** — Components that mix data fetching, business logic, and presentation instead of composing smaller, focused pieces.
