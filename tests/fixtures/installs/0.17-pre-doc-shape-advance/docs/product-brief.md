# Product Brief

## System Purpose

Acme Dispatch is the operations console a regional courier network runs its day on. It
takes the orders flowing in from retail partners and turns them into routed, tracked,
settled deliveries.

## The Problem

Dispatchers today work across a partner portal, a spreadsheet of driver shifts, and a
phone. Nothing reconciles: a driver calls in sick and the orders assigned to them sit
unrouted until someone notices. Partners chase status by email because there is nowhere
to look it up.

## Target Users

**Dispatchers.** They sit in a depot office and own the day's routing. They hire the
system to see every unrouted order in one place and reassign work without leaving the
screen. Success for a dispatcher is a shift where nothing surprised them — no order
discovered at 6pm that should have moved at 10am, no partner calling to ask where a
parcel is.

**Depot managers.** They own throughput and cost across several depots. They hire the
system to compare depots on the numbers rather than on anecdote. Success for a manager
is being able to answer "which depot is slipping and why" from the console instead of
from a monthly export.

**Retail partners.** They hand over orders and want to stop asking about them. Success
is never having to phone the depot.

## Capabilities

**Order intake.** Accept orders from partner APIs and from a manual entry form.
Deduplicate against the partner's own reference. Hold malformed orders in a quarantine
queue a dispatcher can repair.

**Routing.** Assign orders to drivers and shifts. Rebalance a route when a driver drops
out. Suggest an assignment from historical run times, which the dispatcher accepts or
overrides.

**Tracking.** Record scan events along the delivery chain and expose them to partners
and to the dispatcher's board.

**Settlement.** Price each completed delivery against the partner's contract and produce
a monthly reconciliation the finance team signs off.

**Analytics.** Depot-level throughput, on-time rate, and cost per delivery over time.

## The Experience

A dispatcher opens the web console at the start of a shift and lands on the board: every
order in the depot, grouped by state. They work left to right across the board through
the day, dragging unrouted orders onto driver lanes and watching scan events fill in.

Drivers carry a mobile app that captures scans and signatures. It is offline-first — depot
yards and rural routes both lose signal — and syncs when it can.

Partners never open a screen. They integrate against the API and receive webhooks as
their orders move.

Depot managers get the analytics views inside the same web console. A dedicated
operations dashboard is aspirational — the console's views cover it for now.

## Domain Constraints

- A delivery record is never deleted. Corrections are appended as amendments, because
  settlement is audited annually and the audit reads the full history.
- Driver location is retained for 30 days and never exposed to partners.
- The console must remain usable by a dispatcher working one-handed on a depot floor
  terminal.

## Out of Scope

- Consumer-facing parcel tracking. Partners own their end customers; we never contact
  them.
- Fleet maintenance scheduling. That stays in the existing telematics vendor.
- Cross-border customs handling. The network is domestic and will stay domestic.

## Success Indicators

- Unrouted orders at end of shift trend to zero within two months of a depot going live.
- Partner status phone calls to the depot drop by half.
- A dispatcher can reassign a dropped driver's whole route in under two minutes.
- Monthly settlement reconciles without manual adjustment.
- Depot managers stop requesting ad-hoc exports.
