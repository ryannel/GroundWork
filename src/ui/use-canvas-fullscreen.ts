import { useEffect, useState } from 'react';

/** Expand a canvas to the browser viewport, including browsers embedded inside another app. */
export function useCanvasFullscreen(): {
  readonly fullscreen: boolean;
  readonly toggle: () => void;
} {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const escaped = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', escaped);
    return () => {
      document.removeEventListener('keydown', escaped);
    };
  }, []);
  return {
    fullscreen,
    toggle: () => {
      setFullscreen((current) => !current);
    },
  };
}
