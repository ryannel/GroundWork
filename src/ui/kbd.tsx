import styles from './kbd.module.css';

export function Kbd({ keys }: { readonly keys: string }) {
  return <kbd className={styles.kbd}>{keys}</kbd>;
}
