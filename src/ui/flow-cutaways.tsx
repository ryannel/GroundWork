import styles from './flow-cutaways.module.css';
import { Text } from './text';

export interface FlowCutaway {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly stops: readonly string[];
}

/** Compact architectural slices that show participation without claiming one complete journey. */
export function FlowCutaways({ items }: { readonly items: readonly FlowCutaway[] }) {
  return (
    <div className={styles.list}>
      {items.map((item, index) => (
        <article className={styles.cutaway} key={item.id}>
          <header className={styles.header}>
            <Text caps size="sm" tone="faint">
              {String.fromCodePoint(65 + index)}
            </Text>
            <div>
              <Text as="h3" size="lg" weight="strong">
                {item.name}
              </Text>
              <Text as="p" tone="muted">
                {item.summary}
              </Text>
            </div>
          </header>
          <div className={styles.route}>
            {item.stops.map((stop, stopIndex) => (
              <span className={styles.stop} key={`${String(stopIndex)}-${stop}`}>
                {stopIndex === 0 ? null : <span aria-hidden="true" className={styles.line} />}
                <span className={styles.system}>{stop}</span>
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
