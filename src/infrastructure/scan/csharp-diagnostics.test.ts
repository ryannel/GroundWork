import { describe, expect, it, vi } from 'vitest';

import { canonicalCsharpDiagnostics, csharpDiagnosticGaps } from './csharp-diagnostics';

vi.mock(import('server-only'), () => ({}));

describe('stable compiler diagnostic facts', () => {
  const pin = { repo: 'synthetic/csharp', commit: 'a'.repeat(40) };
  const first = 'First.cs(1,1): error CS0246: Missing source dependency';
  const second = 'Second.cs(2,2): error CS1061: Missing external member';
  it('retains error occurrences while normalising input-order permutations', () => {
    expect(canonicalCsharpDiagnostics([second, first, first])).toEqual([first, first, second]);
    expect(csharpDiagnosticGaps([second, first, first], pin)).toEqual(
      csharpDiagnosticGaps([first, second], pin),
    );
    expect(csharpDiagnosticGaps([second, first, first], pin)).toHaveLength(2);
  });
  it('keys identities by pinned error content rather than position', () => {
    const original = csharpDiagnosticGaps([first], pin)[0];
    expect(
      csharpDiagnosticGaps([second, first], pin).find((gap) => gap.description === first)?.id,
    ).toBe(original?.id);
    expect(csharpDiagnosticGaps([first], { ...pin, commit: 'b'.repeat(40) })[0]?.id).not.toBe(
      original?.id,
    );
  });
});
