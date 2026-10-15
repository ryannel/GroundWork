import { type MapShow, SHOW_ALL, SHOW_OVERVIEW } from '@/application/plan-viz-system-map-types';

import styles from './map-toolbar.module.css';
import type { Layer, LineFilter, SystemMapState } from './use-system-map';

const LINES: readonly (readonly [LineFilter, string])[] = [
  ['all', 'All'],
  ['api', 'Calls'],
  ['msg', 'Events'],
  ['data', 'Data'],
];

const LAYERS: readonly (readonly [Layer, string, string])[] = [
  ['parts', 'System parts', 'Each part of a system as its own card'],
  ['ifs', 'Interfaces', 'The interfaces a call lands on'],
  [
    'topics',
    'Topics',
    'Topics under their owner; hidden, an event runs from publisher to listener',
  ],
  ['stores', 'Stores', 'Stores under their keeper; hidden, a read lands on the keeper'],
];

const same = (a: MapShow, b: MapShow): boolean => LAYERS.every(([k]) => a[k] === b[k]);

function Button(props: {
  readonly on: boolean;
  readonly label: string;
  readonly title?: string;
  readonly onPick: () => void;
}) {
  return (
    <button
      aria-pressed={props.on}
      className={styles.button}
      onClick={props.onPick}
      title={props.title}
      type="button"
    >
      {props.label}
    </button>
  );
}

/** What the map shows: how much detail, which lines, and which layers. */
export function MapToolbar({ map }: { readonly map: SystemMapState }) {
  return (
    <div aria-label="Map controls" className={styles.toolbar} role="toolbar">
      <div aria-label="Detail" className={styles.group} role="group">
        <Button
          label="Overview"
          on={same(map.show, SHOW_OVERVIEW)}
          onPick={() => {
            map.setShow(SHOW_OVERVIEW);
          }}
          title="Systems as one card each; no interfaces, topics or stores"
        />
        <Button
          label="Full"
          on={same(map.show, SHOW_ALL)}
          onPick={() => {
            map.setShow(SHOW_ALL);
          }}
          title="Every part, interface, topic and store"
        />
      </div>
      <div aria-label="Lines" className={styles.group} role="group">
        <span className={styles.label}>Lines</span>
        {LINES.map(([kind, label]) => (
          <Button
            key={kind}
            label={label}
            on={map.filter === kind}
            onPick={() => {
              map.setFilter(kind);
            }}
          />
        ))}
      </div>
      <div aria-label="Show" className={styles.group} role="group">
        <span className={styles.label}>Show</span>
        {LAYERS.map(([layer, label, title]) => (
          <Button
            key={layer}
            label={label}
            on={map.show[layer]}
            onPick={() => {
              map.toggleLayer(layer);
            }}
            title={title}
          />
        ))}
      </div>
    </div>
  );
}
