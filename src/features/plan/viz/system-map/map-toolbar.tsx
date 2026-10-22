import { type MapShow, SHOW_ALL, SHOW_OVERVIEW } from '@/application/plan-viz-system-map-types';

import styles from './map-toolbar.module.css';
import type { Layer, LineFilter, SystemMapState } from './use-system-map';

const LINES: readonly (readonly [LineFilter, string])[] = [
  ['all', 'All lines'],
  ['api', 'Calls'],
  ['msg', 'Events'],
  ['data', 'Data'],
];

const LAYERS: readonly Layer[] = ['parts', 'ifs', 'topics', 'stores'];

const same = (a: MapShow, b: MapShow): boolean => LAYERS.every((k) => a[k] === b[k]);

function Button({
  on,
  label,
  title,
  onPick,
}: {
  readonly on: boolean;
  readonly label: string;
  readonly title?: string;
  readonly onPick: () => void;
}) {
  return (
    <button
      aria-pressed={on}
      className={styles.button}
      onClick={onPick}
      title={title}
      type="button"
    >
      {label}
    </button>
  );
}

/** What the map shows, in one row: systems or each component, which lines, and whether infrastructure shows. */
export function MapToolbar({ map }: { readonly map: SystemMapState }) {
  return (
    <div aria-label="Map controls" className={styles.toolbar} role="toolbar">
      <div aria-label="Detail" className={styles.group} role="group">
        <Button
          label="Systems"
          on={same(map.show, SHOW_OVERVIEW)}
          onPick={() => {
            map.setShow(SHOW_OVERVIEW);
          }}
          title="Each system as one card; open one to see its parts"
        />
        <Button
          label="Components"
          on={same(map.show, SHOW_ALL)}
          onPick={() => {
            map.setShow(SHOW_ALL);
          }}
          title="Every component, interface, topic and store"
        />
      </div>
      <div aria-label="Lines" className={styles.group} role="group">
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
      {map.infra.count === 0 ? null : (
        <div aria-label="Infrastructure" className={styles.group} role="group">
          <Button
            label={`Infrastructure · ${String(map.infra.count)}`}
            on={map.infra.shown}
            onPick={() => {
              map.toggleInfra();
            }}
            title="Feature flags, sign-in, error tracking and the like: hidden until asked for"
          />
        </div>
      )}
    </div>
  );
}
