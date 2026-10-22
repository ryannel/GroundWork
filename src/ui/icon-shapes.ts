// Line drawings on a 16 by 16 grid, stroked in currentColor, one per kind of thing.

export interface Shape {
  readonly tag: 'rect' | 'circle' | 'ellipse' | 'path';
  readonly attrs: Readonly<Record<string, string>>;
}

export const ICON_SHAPES = {
  system: [
    {
      tag: 'rect',
      attrs: { x: '1.5', y: '1.5', width: '13', height: '13', rx: '2', strokeDasharray: '2 1.6' },
    },
    { tag: 'rect', attrs: { x: '4', y: '4', width: '8', height: '3.2', rx: '.6' } },
    { tag: 'rect', attrs: { x: '4', y: '8.8', width: '8', height: '3.2', rx: '.6' } },
  ],
  service: [
    { tag: 'rect', attrs: { x: '2.5', y: '2.5', width: '11', height: '4.5', rx: '1' } },
    { tag: 'rect', attrs: { x: '2.5', y: '9', width: '11', height: '4.5', rx: '1' } },
    { tag: 'path', attrs: { d: 'M5 4.75h.01M5 11.25h.01' } },
  ],
  ui: [
    { tag: 'rect', attrs: { x: '1.5', y: '2.5', width: '13', height: '11', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M1.5 5.5h13M3.5 4h.01M5.5 4h.01' } },
  ],
  job: [
    { tag: 'circle', attrs: { cx: '8', cy: '8', r: '5.5' } },
    { tag: 'path', attrs: { d: 'M8 5v3l2 1.5' } },
  ],
  external: [
    {
      tag: 'path',
      attrs: { d: 'M4.5 12.5h7a2.5 2.5 0 0 0 .3-5A3.5 3.5 0 0 0 5 6.6a2.95 2.95 0 0 0-.5 5.9z' },
    },
  ],
  database: [
    { tag: 'ellipse', attrs: { cx: '8', cy: '4', rx: '5', ry: '1.8' } },
    {
      tag: 'path',
      attrs: { d: 'M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8' },
    },
  ],
  bucket: [{ tag: 'path', attrs: { d: 'M2.5 4h11l-1.3 9.1a1 1 0 0 1-1 .9H4.8a1 1 0 0 1-1-.9z' } }],
  topic: [{ tag: 'path', attrs: { d: 'M2 4.5h8M2 8h8M2 11.5h8M11.5 4.5 14 8l-2.5 3.5' } }],
  cache: [{ tag: 'path', attrs: { d: 'M2.5 11.5a5.5 5.5 0 1 1 11 0M8 11.5l2.5-3' } }],
  schema: [
    { tag: 'rect', attrs: { x: '2', y: '2.5', width: '12', height: '11', rx: '1' } },
    { tag: 'path', attrs: { d: 'M2 6h12M2 9.75h12M6.5 6v7.5' } },
  ],
  field: [
    { tag: 'rect', attrs: { x: '2', y: '5.5', width: '12', height: '5', rx: '1' } },
    { tag: 'path', attrs: { d: 'M6.5 5.5v5' } },
  ],
  interface: [{ tag: 'path', attrs: { d: 'M6 2v3M10 2v3M4 5h8v2.5a4 4 0 0 1-8 0zM8 11.5V14' } }],
  endpoint: [
    { tag: 'path', attrs: { d: 'M3 5.5h10M10.5 3 13 5.5 10.5 8M13 10.5H3M5.5 8 3 10.5 5.5 13' } },
  ],
  event: [{ tag: 'path', attrs: { d: 'M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z' } }],
  flow: [
    { tag: 'circle', attrs: { cx: '3.5', cy: '4', r: '1.5' } },
    { tag: 'circle', attrs: { cx: '12.5', cy: '12', r: '1.5' } },
    { tag: 'path', attrs: { d: 'M5 4h5a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h5' } },
  ],
  step: [{ tag: 'path', attrs: { d: 'M4 2.5v5a2 2 0 0 0 2 2h7M10.5 7 13 9.5 10.5 12' } }],
  change: [{ tag: 'path', attrs: { d: 'M8 2.5v6M5 5.5h6M5 12.5h6' } }],
  test: [
    {
      tag: 'path',
      attrs: { d: 'M6 2h4M6.5 2v4L3 12.5a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5L9.5 6V2' },
    },
  ],
  ticket: [
    { tag: 'path', attrs: { d: 'M2 4.5h12v2a1.5 1.5 0 0 0 0 3v2H2v-2a1.5 1.5 0 0 0 0-3z' } },
  ],
  milestone: [{ tag: 'path', attrs: { d: 'M3.5 14V2.5M3.5 3h8L10 5.5 11.5 8h-8' } }],
  decision: [
    { tag: 'path', attrs: { d: 'M8 2.5v11M5 13.5h6M3 4.5h10M3 4.5 1.5 9h3zM13 4.5 11.5 9h3z' } },
  ],
  risk: [{ tag: 'path', attrs: { d: 'M8 2 14.5 13.5h-13zM8 6.5v3M8 11.5h.01' } }],
  question: [
    { tag: 'circle', attrs: { cx: '8', cy: '8', r: '6' } },
    { tag: 'path', attrs: { d: 'M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M8 11.5h.01' } },
  ],
  scenario: [
    { tag: 'circle', attrs: { cx: '8', cy: '5', r: '2.5' } },
    { tag: 'path', attrs: { d: 'M3 14a5 5 0 0 1 10 0' } },
  ],
  team: [
    { tag: 'circle', attrs: { cx: '6', cy: '5.5', r: '2.2' } },
    { tag: 'circle', attrs: { cx: '11.2', cy: '6.5', r: '1.8' } },
    { tag: 'path', attrs: { d: 'M2 13.5a4 4 0 0 1 8 0M10.5 10a3.2 3.2 0 0 1 4 3' } },
  ],
  concept: [
    {
      tag: 'path',
      attrs: {
        d: 'M2.5 3.5h4A1.5 1.5 0 0 1 8 5v8.5A1.5 1.5 0 0 0 6.5 12h-4zM13.5 3.5h-4A1.5 1.5 0 0 0 8 5v8.5A1.5 1.5 0 0 1 9.5 12h4z',
      },
    },
  ],
  stage: [{ tag: 'path', attrs: { d: 'M6 3.5 10.5 8 6 12.5' } }],
  screen: [
    { tag: 'rect', attrs: { x: '1.5', y: '2.5', width: '13', height: '11', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M1.5 5.5h13' } },
    { tag: 'rect', attrs: { x: '3.5', y: '7.5', width: '5', height: '4', rx: '.6' } },
    { tag: 'path', attrs: { d: 'M10.5 8h2M10.5 10.5h2' } },
  ],
  region: [
    {
      tag: 'rect',
      attrs: { x: '2', y: '3', width: '12', height: '10', rx: '1', strokeDasharray: '2 1.6' },
    },
    { tag: 'rect', attrs: { x: '4.5', y: '5.5', width: '7', height: '5', rx: '.6' } },
  ],
  graph: [
    { tag: 'path', attrs: { d: 'M8 1.5 13.8 4.75v6.5L8 14.5 2.2 11.25v-6.5z' } },
    { tag: 'path', attrs: { d: 'M8 5.2 11 6.9v3.2L8 11.8 5 10.1V6.9z' } },
  ],
  subgraph: [{ tag: 'path', attrs: { d: 'M8 2 13.5 5v6L8 14 2.5 11V5z' } }],
  key: [
    { tag: 'circle', attrs: { cx: '5', cy: '8', r: '2.6' } },
    { tag: 'path', attrs: { d: 'M7.6 8H14M11.5 8v2.2M13.5 8v1.6' } },
  ],
  lock: [
    { tag: 'rect', attrs: { x: '3.5', y: '7', width: '9', height: '6.5', rx: '1.2' } },
    { tag: 'path', attrs: { d: 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2' } },
  ],
  search: [
    { tag: 'circle', attrs: { cx: '7', cy: '7', r: '4.5' } },
    { tag: 'path', attrs: { d: 'M10.4 10.4 14 14' } },
  ],
} satisfies Readonly<Record<string, readonly Shape[]>>;
