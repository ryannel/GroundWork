import { describe, expect, it, vi } from 'vitest';

import { canonicalDataLiteral, storybookConfiguration } from './canonical-data-fixture';

vi.mock(import('server-only'), () => ({}));

describe('whole-file canonical data literal proof', () => {
  it.each([
    'export default {offersByMarket:{customerTypes:[{name:"fleet", enabled:true, value:null, amount:-2}]}};',
    'export default [{ value: 1 }, "name", false, null];',
    'export default "sample";',
  ])('accepts only a complete literal export: %s', (content) => {
    expect(canonicalDataLiteral('sample.ts', content)?.literalNodes).toBeGreaterThan(0);
  });
  it.each([
    'import "runtime"; export default {};',
    'export default {}; run();',
    'export default factory();',
    'export default {value: token};',
    'export default {...other};',
    'export default {["key"]: 1};',
    'export default {get key(){return 1;}};',
    'export default {key(){return 1;}};',
    'export default {key: () => 1};',
    'export default condition ? {} : [];',
    'export default [,...items];',
    'export default [undefined];',
    'export default {key};',
    'export default /pattern/;',
    'export = {};',
    'const value = {}; export default value;',
    'export default {key: 1;',
    'export default {key: `value`};',
  ])('rejects executable, dynamic or malformed source: %s', (content) => {
    expect(canonicalDataLiteral('sample.ts', content)).toBeUndefined();
  });
  it('requires a real supported Storybook import in syntactically valid config', () => {
    expect(
      storybookConfiguration(
        'main.ts',
        "import {getPreset} from '@vcc-package/storybook-utils/preset-vite'; export default getPreset({});",
      ),
    ).toBe(true);
    expect(storybookConfiguration('main.ts', '// @storybook/react\nexport default {};')).toBe(
      false,
    );
    expect(
      storybookConfiguration('main.ts', "import {x} from '@storybook/react'; export default {"),
    ).toBe(false);
  });
});
