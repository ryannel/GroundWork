import type { Model } from '@/application/plan/derive';
import { tintedDocument, type TintToken } from '@/application/plan-viz-waterfall-tint';

import styles from './tinted-document.module.css';

interface TintedDocumentProps {
  readonly model: Model;
  /** The operation, by id. */
  readonly id: string;
  readonly mode?: 'asIs' | 'toBe';
}

/** Each run of text with where it starts in the document, which is its own key. */
function located(tokens: readonly TintToken[]): { at: number; token: TintToken }[] {
  let at = 0;
  return tokens.map((token) => {
    const here = at;
    at += token.text.length;
    return { at: here, token };
  });
}

// An operation's document with each field name coloured by the team that answers it; the fields the gateway adds
// on its own are faint and italic. Draws nothing when the operation has no document.
export function TintedDocument({ model, id, mode }: TintedDocumentProps) {
  const tokens = tintedDocument(model, id, mode);
  if (tokens.length === 0) return null;
  return (
    <pre className={styles.document}>
      {located(tokens).map(({ at, token }) =>
        token.slot === undefined && token.router !== true ? (
          token.text
        ) : (
          <span
            className={styles.name}
            data-router={token.router === true ? '' : undefined}
            data-slot={token.slot}
            key={at}
            title={token.title}
          >
            {token.text}
          </span>
        ),
      )}
    </pre>
  );
}
