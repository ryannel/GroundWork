import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { evaluateNextDepth } from './scan-depth-next';
import { namedFunction, semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));

const ADDRESS = `function StepAddress({onNextAction}: Props) {
  const handleSelect = async (location: Location) => {
    try {
      const res = await fetch('/api/ev-subsidy/eligibility', {method: 'POST'});
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setIsEligible(data.eligible);
    } catch(error) {
      console.error(error);
      setIsEligible(false);
    } finally { setLoading(false); }
  };
  return <button onClick={() => onNextAction()} disabled={loading || isEligible !== true}/>;
}`;

const INCOME = `function StepPersons({onNext}: Props) {
  const submitData = async () => {
    try {
      const res = await fetch('/api/ev-subsidy/income');
      if (!res.ok) throw new Error('failed');
      const { incomeSection } = await res.json();
      if (incomeSection.status === 'eligible') {
        onNext({
          qualifiesForStartBonus: incomeSection.details.qualifiesForStartBonus,
          adjustedIncome: incomeSection.details.adjustedIncome,
          maxAdjustedIncome: incomeSection.details.maxAdjustedIncome,
          maxHouseholdIncome: incomeSection.details.maxHouseholdIncome,
          startBonusHouseholdIncome: incomeSection.details.startBonusHouseholdIncome,
          startBonusThreshold: incomeSection.details.startBonusThreshold,
        });
      } else { onNext(); }
    } catch(error) { console.error(error); }
    finally { setLoading(false); }
  };
}`;

const SERVER =
  "const baseUrl = 'https://example.invalid';\n" +
  `async function POST(req: Request) {
  const body = await req.json();
  const { lat, lng } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number') { return; }
  const lookupRes = await fetch(\`\${baseUrl}/api/v1/lookup/deso?lat=\${lat}&lon=\${lng}\`, {headers: {}});
  const lookupData = await lookupRes.json();
  const desoCode = lookupData?.desoCode;
  const eligibilityPayload = {
    geography: { monthsAtAddress: 4, monthsInArea: 12, desoCode, municipalityCode: lookupData.municipalityCode }
  };
  const eligibilityRes = await fetch(\`\${baseUrl}/api/v1/eligibility/status\`, {method: 'POST', body: JSON.stringify(eligibilityPayload)});
}`;

function evaluate(source: string, symbol: string, check: string) {
  const index = indexSource({ path: 'review.tsx', language: 'typescript', content: source });
  expect(index.diagnostics).toEqual([]);
  const local = extractLocalFacts(index, {
    host: 'host:review',
    repo: 'fixture/review',
    commit: 'a'.repeat(40),
  });
  const graph = semanticGraph({
    ...scanFixture(),
    semantic: [...(local.semantic ?? [])],
    summaries: [...local.summaries],
    sources: [...local.sources],
  });
  return evaluateNextDepth(graph, namedFunction(graph, symbol)?.owner ?? '', check);
}

describe('adversarial frontend lineage acceptance', () => {
  it('requires the address state value to originate from awaited response JSON', () => {
    const check = 'ts-address-response-and-availability';
    expect(evaluate(ADDRESS, 'StepAddress', check)?.status).toBe('supported');
    const changed = ADDRESS.replace(
      'const data = await res.json();',
      'const ignored = await res.json(); const data = {eligible: true};',
    );
    expect(evaluate(changed, 'StepAddress', check)?.status).not.toBe('supported');
  });

  it('requires the six income details to originate from the response destructuring', () => {
    const check = 'ts-income-response-to-onNext';
    expect(evaluate(INCOME, 'StepPersons', check)?.status).toBe('supported');
    const changed = INCOME.replace(
      'const { incomeSection } = await res.json();',
      'const ignored = await res.json(); const incomeSection = {status: "eligible", details: {}};',
    );
    expect(evaluate(changed, 'StepPersons', check)?.status).not.toBe('supported');
  });

  it('requires the lookup request to retain default GET or explicit GET semantics', () => {
    const check = 'ts-server-lineage-and-hops';
    expect(evaluate(SERVER, 'POST', check)?.status).toBe('supported');
    const changed = SERVER.replace('{headers: {}}', '{method: "POST", headers: {}}');
    expect(evaluate(changed, 'POST', check)?.status).not.toBe('supported');
  });
});
