import { describe, expect, it } from 'vitest';

import { htmlFields } from './html';
import { captureRoute } from './route-response';
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
