import { useCallback, useEffect, useRef, useState } from 'react';

const HOLD_MS = 1600;

/** Puts text on the clipboard and says so for a moment; `failed` when the browser refused. */
export function useCopy(text: string): {
  readonly state: 'idle' | 'copied' | 'failed';
  readonly copy: () => void;
} {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(() => {
    const done = (next: 'copied' | 'failed') => {
      setState(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setState('idle');
      }, HOLD_MS);
    };
    navigator.clipboard.writeText(text).then(
      () => {
        done('copied');
      },
      () => {
        done('failed');
      },
    );
  }, [text]);
  return { state, copy };
}
