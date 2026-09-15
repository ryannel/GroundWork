# Product page UI review

Reviewed `/w/wordloop/meeting-intelligence?component=c-wl-core` in overview, selected/pinned, expanded, direct-context, data-detail and API-empty states. Checked desktop, the normal in-app browser width, a 390px mobile viewport, and dark/light themes.

## Changes

- Added an expanded map with Escape, keyboard focus containment and focus restoration. Expanding and collapsing preserve node positions and pins; the viewport fits its new container size.
- Fitted Direct context to its container. The dependency column is no longer clipped at the normal browser width.
- Replaced the previously hidden mobile Direct context with tappable caller/dependency cards. The complete System map remains available separately.
- Simplified the graph header and tightened the product summary. Improved control, metadata and detail-tab typography.
- Increased contrast for non-selected nodes and edges, including in light mode.
- Added arrow-key/Home/End navigation and linked tab/panel semantics to the component detail tabs.
- Corrected “API” capitalization and clarified the API empty-state copy without treating missing catalog data as proof of no API.

## Captures

### Before

- [Full overview](before-overview.png)
- [Clipped Direct context](before-direct-context.png)
- [API empty state](before-api-empty.png)

### After

- [System map at normal browser width](after-system-map.png)
- [Full desktop page](after-overview-desktop.png)
- [Expanded map at desktop width](after-expanded-desktop.png)
- [Expanded map at normal browser width](after-expanded-map.png)
- [Pinned-node state](after-pinned-map.png)
- [Direct context](after-direct-context.png)
- [Data details](after-data-details.png)
- [API empty state](after-api-empty.png)
- [Light-theme desktop page](after-light-overview.png)
- [Mobile overview](after-mobile-overview.png)
- [Mobile Direct context](after-mobile-direct-context.png)

## Verification

Checked Direct context fitting, mobile component navigation, detail-tab keyboard navigation, pin preservation across expanded mode, Escape to collapse, and auto layout. Restored the original dark theme, normal viewport, Core selection and System map when finished.

TypeScript, lint, the production build, and the seven graph layout/physics regression tests pass. The build retains the existing large ELK bundle warning.
