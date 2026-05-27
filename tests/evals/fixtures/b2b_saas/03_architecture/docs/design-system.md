# Design System: StoreLens Analytics

Professional-grade B2B operations dashboard. Graphical UI track. Dense, data-focused, desktop-first.

## Key decisions

- **Track:** Graphical UI
- **Tone:** Calm, precise, authoritative
- **Layout:** Top nav + left sidebar drill-down. Desktop-first (1280px+), tablet-supported (768px+).
- **Colours:** Navy/slate dark backgrounds with white content areas. Brand blue (#2563EB). Status colours: green (on-track), amber (at-risk), red (breached).
- **Typography:** Inter, tabular numbers on data cells, 14px body/table default.
- **Density:** Compact table rows (12px vertical padding). No excessive whitespace.
- **Components:** KPI cards with trend indicators, data tables (sortable, virtualised at 1000+ rows), status badge pills, alert banners, empty states with action prompts.

## App-shell architectural signals

- Real-time dashboard auto-refresh (60s) → SSE or WebSocket connection from frontend to analytics service
- Alert configuration with Slack delivery → notification service or webhook dispatcher required
- Multi-tenant session model → session state must be tenant-scoped in the backend
