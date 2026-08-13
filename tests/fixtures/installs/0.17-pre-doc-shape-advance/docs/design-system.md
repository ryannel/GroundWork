# Design System

The visual and interaction language for Acme Dispatch. Every value here is committed:
an implementer makes no design decisions.

# Part 1 — Constraints

**Performance budgets.** First contentful paint under 1.5s on depot-floor hardware
(2018-era Chromebooks over depot wifi). Board interactions respond within 100ms; a
reassignment round trip completes within 400ms or shows optimistic state.

**Accessibility baseline.** WCAG 2.2 AA across the console. Contrast floor 4.5:1 for
body text and 3:1 for interface elements. Every board action reachable by keyboard —
dispatchers work one-handed and the drag interaction always has a keyboard twin.

**Platform targets.** Chrome and Edge, current and previous major. No IE, no Safari on
the depot floor. The mobile driver app targets Android 10+ and iOS 15+.

**Error tolerance.** The board never blocks on a failed write. A failed reassignment
rolls back visibly and stays actionable; it never silently reverts.

# Part 2 — Shell

**Navigation model.** One persistent left rail with four destinations: Board, Orders,
Drivers, Analytics. The rail collapses to icons below 1100px. No nested navigation — a
dispatcher never navigates more than one level from the board.

**Layout skeleton.** A fixed header carrying depot selector and shift clock, the rail,
and a single scrolling work area. The board is the work area's default occupant.

**Empty and loading states.** Every list has an authored empty state naming the next
action. Loading uses skeleton rows matching final row height, never spinners — a
shifting layout on a touch terminal costs a mis-tap.

## Colour Architecture

**Primary** — `oklch(58% 0.16 248)`, used for primary actions and the active rail
destination; never for body text.

**Surface** — `oklch(98% 0.004 248)` light, `oklch(21% 0.008 248)` dark. Chroma stays
under `0.01` so status colour on the board reads as the only saturated thing on screen.

**Status roles** — unrouted `oklch(72% 0.17 65)`, in-transit `oklch(62% 0.14 248)`,
delivered `oklch(64% 0.15 150)`, exception `oklch(58% 0.20 25)`. These four are the
board's whole vocabulary; nothing else on the board carries chroma.

## Typography

**Family** — Inter for interface, `ui-monospace` for order references and scan codes.

**Scale** — 12 / 14 / 16 / 20 / 28, 1.5 line height for body and 1.25 for headings.
Board rows use 14; a dispatcher scanning a full board reads density before hierarchy.

## Components

**Board lane** (`apps/console/src/components/board/Lane.tsx`) — a driver's column on the
board. Accepts dropped order cards, shows shift capacity in its header, and dims when
the driver is marked unavailable.

**Order card** (`apps/console/src/components/board/OrderCard.tsx`) — one order on the
board. Carries its status colour on the left edge, the partner reference in mono, and
the promised window.

**Status pill** (`apps/console/src/components/StatusPill.tsx`) — the status vocabulary
anywhere outside the board. Colour role plus label; never colour alone.

**Depot selector** (`apps/console/src/components/DepotSelector.tsx`) — header control
switching the whole console's depot scope. Confirms before switching when unsaved board
changes exist.

**Data table** (`apps/console/src/components/DataTable.tsx`) — the Orders and Drivers
lists. Sticky header, keyboard row navigation, no horizontal scroll under 1100px.

## Motion

Transitions are 120ms `cubic-bezier(0.2, 0, 0, 1)` for state changes and 200ms for
layout changes. Drag feedback is instantaneous — no easing on pointer-tracked motion.
Motion is suppressed entirely under `prefers-reduced-motion`.

## Voice

Interface copy is plain and operational. Errors name what failed and what to do next.
Never apologise, never blame the user, never use exclamation marks.
