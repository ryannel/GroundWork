import { describe, expect, it, vi } from 'vitest';

import { htmlFields } from './html';
import { capturedPageSize, captureRoute } from './route-response';
import { writeSnapshot } from './snapshots';

describe('capture trust boundaries', () => {
  it('refuses snapshot file names outside the chosen output folder or executable extensions', async () => {
    await expect(writeSnapshot('/unused', '../outside.json', {})).rejects.toThrow(
      'JSON data file name',
    );
    await expect(writeSnapshot('/unused', 'download.js', {})).rejects.toThrow(
      'JSON data file name',
    );
  });
  it('decodes entities once and excludes raw script/style content regardless of case', () => {
    const fields = htmlFields(
      '<H1>A &amp;lt; B <span>&amp; C</span></H1><ScRiPt><h1>hidden</h1></SCRIPT><STYLE>hidden</style><p data-inspect="api:x">End</p>',
      new URL('http://127.0.0.1:3000/probe/'),
    );
    expect(fields.headings).toEqual(['A &lt; B & C']);
    expect(fields.payload).toEqual({ text: 'A &lt; B & C End', inspectedIds: ['api:x'] });
  });

  it('retains same-origin query/hash links and ignores script strings and outside links', () => {
    const fields = htmlFields(
      '<script>const href="/wrong";</script><a href="/probe/?a=1&amp;b=2#here">Local</a><a href="https://example.com/">Outside</a>',
      new URL('http://127.0.0.1:3000/'),
    );
    expect(fields.links).toEqual(['/probe/?a=1&b=2#here']);
    expect(fields.payload.text).toBe('Local Outside');
  });

  it('captures the visible facts around a large production payload without counting its hidden tags', () => {
    const payload = `<!--${'<x data-inspect="api:hidden">α</x>'.repeat(100_000)}-->`;
    const fields = htmlFields(
      `<h1>Workspace</h1><script>${payload}</script><a href="/map/" data-inspect="api:visible">Map</a>`,
      new URL('http://127.0.0.1:3000/'),
    );
    expect(fields).toEqual({
      headings: ['Workspace'],
      links: ['/map/'],
      payload: { text: 'Workspace Map', inspectedIds: ['api:visible'] },
    });
  });

  it('records the same inert response body it measures without a second fetch', async () => {
    const body = '<h1>Measured once</h1>';
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }));
    const record = vi.fn<(body: string) => Promise<void>>().mockResolvedValue();
    try {
      const response = await captureRoute('http://127.0.0.1:3000', '/probe/', record);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(body);
      expect(response.htmlBytes).toBe(Buffer.byteLength(body));
      expect(response.headings).toEqual(['Measured once']);
    } finally {
      fetch.mockRestore();
    }
  });

  it('reuses actual query-selected HTML measurements and never substitutes missing or invalid sizes', () => {
    expect(
      capturedPageSize({ route: '/entries/?id=api:known', type: 'text/html', htmlBytes: 1025 }),
    ).toEqual({
      page: '/entries/?id=api:known',
      bytes: 1025,
    });
    expect(
      capturedPageSize({ route: '/model.json', type: 'application/json', htmlBytes: null }),
    ).toBeNull();
    for (const htmlBytes of [undefined, null, -1, Infinity, '0']) {
      expect(() => capturedPageSize({ route: '/entries/', type: 'text/html', htmlBytes })).toThrow(
        'valid HTML',
      );
    }
    expect(() => capturedPageSize({})).toThrow('missing its address');
  });

  it('rejects remote origins and manifest routes that leave the local server before fetching', async () => {
    await expect(captureRoute('https://example.com', '/probe/')).rejects.toThrow('loopback');
    await expect(captureRoute('http://127.0.0.1:3000', '//example.com/')).rejects.toThrow(
      'same-origin',
    );
    await expect(captureRoute('http://127.0.0.1:3000', 'https://example.com/')).rejects.toThrow(
      'same-origin',
    );
  });
});
