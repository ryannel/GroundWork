'use client';

import { useEffect, useId, useState } from 'react';

// Client-side renderer for a single ```mermaid block. The remark transform in
// source.config.ts rewrites each fenced mermaid block into `<Mermaid chart="…" />`, and the
// docs page passes this component into the MDX components map. Rendering happens in the
// browser via mermaid's own renderer — `next build` never needs a headless browser, so the
// site stays plain-Markdown and Playwright-free. Re-renders on light/dark toggle (Fumadocs
// flips the `dark` class on <html>).
export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const rawId = useId();
  const id = 'mmd-' + rawId.replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let active = true;

    const render = async () => {
      const mermaid = (await import('mermaid')).default;
      if (!active) return;
      const isDark = document.documentElement.classList.contains('dark');
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'strict',
      });
      try {
        const { svg } = await mermaid.render(id, chart);
        if (active) setSvg(svg);
      } catch {
        // A malformed diagram should never crash the page.
        if (active) setSvg('');
      }
    };

    void render();

    const observer = new MutationObserver(() => void render());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [chart, id]);

  if (!svg) {
    // Pre-render / pre-hydration fallback: show the source so the diagram is never blank.
    return (
      <pre className="mermaid-fallback">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      className="my-4 flex justify-center"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
