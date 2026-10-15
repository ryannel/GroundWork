import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import type { Outline } from '@/application/plan-pages';
import { thingHref } from '@/application/plan-pages-things';

import styles from './thing-register.module.css';

interface ThingRegisterProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly id: string;
  readonly siblings: readonly string[];
  readonly title: string;
}

// The others of its kind down the side, the open one marked, so the reader can move along the register.
export function ThingRegister({ model, outline, id, siblings, title }: ThingRegisterProps) {
  return (
    <nav aria-label={title} className={styles.register}>
      <h2 className={styles.title}>{title}</h2>
      <ol className={styles.list}>
        {siblings.map((x) => (
          <li key={x}>
            <Link
              aria-current={x === id ? 'page' : undefined}
              className={styles.item}
              href={thingHref(outline, x)}
            >
              {model.label(x)}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
