# Testing & Smoke

## Table of Contents
- [The Three Tiers](#the-three-tiers)
- [Unit: Node Project (Main Policy)](#unit-node-project-main-policy)
- [Unit: Renderer Project (Fake the Bridge)](#unit-renderer-project-fake-the-bridge)
- [The Playwright _electron Smoke](#the-playwright-_electron-smoke)
- [_electron Patterns](#_electron-patterns)
- [CI: xvfb and Skip-with-Reason](#ci-xvfb-and-skip-with-reason)
- [Keeping the Smoke Thin](#keeping-the-smoke-thin)
- [Test Commands](#test-commands)

---

## The Three Tiers

| Tier | Tool | Environment | Proves |
|---|---|---|---|
| Unit (main) | vitest, `main` project | plain Node | The pure security/policy rules |
| Unit (renderer) | vitest, `renderer` project | jsdom, bridge faked | Components against the bridge contract |
| Smoke (boot) | Playwright `_electron` | the real built app | Boot, rendering, IPC wiring, theme push |

This maps onto the multi-surface verification contract: generation (snapshot, framework-side), compilation (`tsc` + lint), boot (the smoke). Business rules are **not** on this list — they are proven once at the capability core's contract; surface tests assert wiring and rendering only.

These tiers are the Electron idiom of the framework testing canon (`docs/principles/foundations/testing.md`): the renderer and main unit tests are the fat middle the canon's honeycomb puts the weight on, and the boot smoke is the thin top — a fat smoke is the fat-integration-suite antipattern wearing a desktop coat. When this file and the canon disagree, the canon wins and this file is the one to fix.

`vitest.config.ts` defines the two unit projects with per-process environments. Test placement follows the process split: `src/main/**/*.test.ts` runs in Node, `src/renderer/**/*.test.tsx` runs in jsdom. A test that needs the wrong environment is in the wrong process.

## Unit: Node Project (Main Policy)

Main's testable logic lives in pure modules (`policy.ts` — no Electron imports), so it runs in plain Node with zero mocking:

```ts
it.each(['http://example.com', 'file:///etc/passwd', 'javascript:alert(1)'])(
  'rejects %s', (url) => expect(isAllowedExternalUrl(url)).toBe(false),
);
```

When adding privileged logic, keep this shape: decision in a pure module + test; wiring in the thin Electron glue, proven by the smoke. Do not import `electron` in a vitest file — in plain Node the module resolves to the binary path string, not the API, and mocking the whole surface buys nothing the pure-module split doesn't buy better.

## Unit: Renderer Project (Fake the Bridge)

The renderer's platform surface is `window.api`, so tests fake exactly that seam:

```tsx
const fakeApi: RendererApi = {
  getStatus: async () => ({ status: 'ok', version: '0.1.0-test', platform: 'test' }),
  openExternal: async () => ({ opened: false }),
  onThemeChanged: () => () => undefined,
};
beforeEach(() => {
  Object.defineProperty(window, 'api', { value: fakeApi, configurable: true });
});
```

Typing the fake as `RendererApi` keeps it honest: a contract change breaks the fake at compile time. Async UI rule: query-backed components render their pending state first — `await screen.findByText(...)` past it; asserting on the container immediately races the resolution.

Everything else about component testing — Testing Library idiom, what to assert, accessibility queries — is the web stack's, unchanged: `groundwork-nextjs-engineer/references/testing.md`.

## The Playwright _electron Smoke

Playwright's Electron support is officially "experimental" but is the de-facto standard (VS Code tests with it); it is the reason GroundWork picked this stack — the strongest agent-closable loop of any desktop option. The driver needs **no browser downloads** (`playwright install` is unnecessary): it launches the app's own Electron binary.

The generated smoke (`tests/smoke/app.spec.ts`) is the canonical shape: launch the **built** app, first window, title + rendered heading, one IPC round-trip, the theme push channel, one main-process assertion.

## _electron Patterns

```ts
import { _electron as electron } from 'playwright';

const app = await electron.launch({ args: ['out/main/index.js'] });
const page = await app.firstWindow();          // a normal Playwright Page
```

- **Renderer assertions** — everything Playwright can do to a web page: `expect(page).toHaveTitle(...)`, `getByRole`, `getByTestId`, screenshots.
- **Bridge round-trips** — `page.evaluate(() => globalThis.api.foo())` exercises preload + sender validation + handler end-to-end. (Cast `globalThis`; the smoke compiles under the node tsconfig, which has no DOM types.)
- **Main-process assertions** — `app.evaluate(({ app, nativeTheme }) => ...)` runs **inside main** with the electron module injected: assert on windows, theme state, app metadata. This hook is unique to Electron among desktop options.
- **Push-channel proof** — assert the DOM consequence, e.g. `toHaveAttribute('data-theme', /^(light|dark)$/)` after main's initial broadcast.
- **Always `await app.close()`** in a `finally` — a leaked Electron process wedges CI workers.
- Launching a **packaged** binary instead of the dev build: `electron.launch({ executablePath })` — worth one lane before releases; the day-to-day smoke uses the built output for speed.
- Driver/runtime pairings can regress across Electron majors (the 36.x `Process failed to launch!` Linux regression, fixed in 37) — when a major bump breaks launch, check the pairing before debugging the app.

## CI: xvfb and Skip-with-Reason

Electron is never truly headless — Linux CI needs a display server. The `smoke` target routes through `tool/electron_exec.sh`, which:

1. Verifies `node_modules` and the Electron binary exist (bootstrap state) — else **"tier skipped"** with the bootstrap command.
2. On Linux with no `DISPLAY`/`WAYLAND_DISPLAY`: wraps the run in `xvfb-run --auto-servernum` when available — else **"smoke tier skipped"** naming xvfb.
3. Builds, then runs `playwright test`.

The contract is *skipped-with-reason, never silently green*: a missing toolchain degrades exactly the way a missing Docker daemon degrades `./dev`. CI installs `xvfb` to run the lane for real; macOS/Windows runners and desktop sessions need no wrapper. Artifacts on failure (screenshot, trace) are configured in `playwright.config.ts`.

## Keeping the Smoke Thin

Boot minutes are this stack's expensive test currency. The smoke proves the app **boots and is wired** — it is not an E2E suite:

- One spec, happy path, serial (`workers: 1`).
- New IPC channels get unit tests (policy + renderer fake) by default; extend the smoke only when a channel's *wiring* is novel (new push mechanism, new window).
- Feature behaviour belongs in renderer unit tests; business rules belong at the core's contract. A fat smoke is the fat-integration-suite antipattern wearing a desktop coat.

## Mutation Testing — the assertion-quality read-out

The main-process policy modules (`policy.ts` — URL allow-listing, sender validation, IPC guards) are dense security logic, exactly where a covered-but-unasserted line is a real risk. **StrykerJS** is the read-out that proves those tests bite: it mutates the rule and confirms a test fails. Treat it as a **signal, never a gate**, run it incrementally on changed code (`stryker run --incremental`), and point it at the pure policy modules first — a surviving mutant on a security rule is the missing assertion to add. The renderer's pure logic earns the same spot check; the Electron glue and the smoke do not (they prove wiring, not branches).

## Test Commands

```bash
npx nx run <app>:test        # both vitest projects (node + jsdom)
npx nx run <app>:test -- --project renderer   # one project
npx nx run <app>:smoke       # build + Playwright _electron (display-guarded)
npx nx run <app>:typecheck   # tsc, both process tsconfigs
npx nx run <app>:lint        # eslint incl. process-boundary rules
```

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice rolls out permanent coverage before it closes (bet workflow, Delivery). The bet-progress tests prove the capability once and are archived; these stay. Test placement follows the process split, and surface tests assert wiring and rendering only — never a business rule the capability core already owns.

- **Main policy unit tests (when the slice added privileged logic).** Every new security or policy decision the slice introduced gets a pure-module test in the `main` project, with the rejection cases exercised, not just the allow case — this is the densest risk surface in the stack.
- **Renderer unit tests (when the slice added a component or state).** Components the slice introduced with conditional rendering, async pending states, or error handling get jsdom tests against the faked `window.api` bridge; the typed fake keeps the bridge contract honest.
- **Smoke extension (only when wiring is novel).** A new IPC channel gets unit tests by default; extend the boot smoke only when the channel's *wiring* is genuinely new — a new push mechanism or window — never for feature behaviour. Trace assertions do not apply — an Electron app emits no OpenTelemetry traces, so there is no span surface to assert on.
