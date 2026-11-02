import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { evaluateNextDepth } from './scan-depth-next';
import { namedFunction, semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));

const ADDRESS = `
function AddressInput({onSelectAction}) {
 const handlePlaceChanged = () => {
  if (!autocomplete) return;
  const place = autocomplete.getPlace();
  if (!place.geometry?.location) return;
  onSelectAction({address: place.formatted_address ?? '', lat: place.geometry.location.lat(), lng: place.geometry.location.lng()});
 };
 return <Autocomplete onPlaceChanged={handlePlaceChanged}/>;
}
function StepAddress({onNextAction}) {
 const handleSelect = async (location) => {
  try {
   const res = await fetch('/api/ev-subsidy/eligibility', {method:'POST', body:JSON.stringify({lat:location.lat,lng:location.lng})});
   if (!res.ok) throw new Error('failed');
   const data = await res.json();
   setIsEligible(data.eligible);
  } catch(error) { console.error(error); setIsEligible(false); } finally {setLoading(false);}
 };
 return <div><AddressInput onSelectAction={handleSelect}/><button disabled={loading || isEligible !== true} onClick={()=>{onNextAction(); tracker.customEvent({});}}/></div>;
}`;
const INCOME = `
function StepPersons({onNext}) {
 const rows = sourceRows; const childrenAmount = sourceChildren;
 const submitData = async () => {
  try {
   setLoading(true);
   const res = await fetch('/api/ev-subsidy/income',{method:'POST',body:JSON.stringify({rows,childrenAmount})});
   if(!res.ok) throw new Error('failed');
   const {incomeSection} = await res.json();
   if(incomeSection.status === 'eligible') onNext({
    qualifiesForStartBonus:incomeSection.details.qualifiesForStartBonus,
    adjustedIncome:incomeSection.details.adjustedIncome,
    maxAdjustedIncome:incomeSection.details.maxAdjustedIncome,
    maxHouseholdIncome:incomeSection.details.maxHouseholdIncome,
    startBonusHouseholdIncome:incomeSection.details.startBonusHouseholdIncome,
    startBonusThreshold:incomeSection.details.startBonusThreshold
   }); else onNext();
  } catch(err){console.error(err);} finally{setLoading(false);}
 };
 return <button disabled={hasEmptyFields || loading} onClick={()=>{submitData();tracker.customEvent({});}}/>;
}`;

const SERVER = `
export async function POST(req) {
 try {
  const apiKey = process.env.PREMIE_API_KEY;
  if(!apiKey) return NextResponse.json({error:'key'},{status:500});
  const body = await req.json(); const {lat,lng} = body;
  if(typeof lat !== 'number' || typeof lng !== 'number') return NextResponse.json({error:'invalid'},{status:400});
  const lookupRes = await fetch(\`\${baseUrl}/api/v1/lookup/deso?lat=\${lat}&lon=\${lng}\`,{headers:{}});
  if(!lookupRes.ok) return NextResponse.json({error:'lookup'},{status:lookupRes.status});
  const lookupData = await lookupRes.json(); const desoCode = lookupData?.desoCode;
  if(!desoCode) return NextResponse.json({error:'deso'},{status:400});
  const eligibilityPayload = {geography:{monthsAtAddress:4,monthsInArea:12,desoCode,municipalityCode:lookupData.municipalityCode}};
  const eligibilityRes = await fetch(\`\${baseUrl}/api/v1/eligibility/status\`,{method:'POST',body:JSON.stringify(eligibilityPayload)});
  if(!eligibilityRes.ok) return NextResponse.json({error:'eligibility'},{status:eligibilityRes.status});
  const eligibilityData = await eligibilityRes.json();
  const geographySection = eligibilityData.sections.find((s)=>s.id === 'geography');
  const eligible = geographySection?.status === 'eligible';
  return NextResponse.json({eligible});
 } catch(error){ return NextResponse.json({error:'unexpected'},{status:500}); }
}`;

function evaluate(content: string, id: string) {
  const index = indexSource({ content, path: 'fixture.tsx', language: 'typescript' });
  const facts = extractLocalFacts(index, {
    host: 'host:server',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  const graph = semanticGraph({
    ...scanFixture(),
    semantic: [...(facts.semantic ?? [])],
    summaries: [...facts.summaries],
    sources: [...new Map(facts.sources.map((source) => [source.id, source])).values()],
  });
  return evaluateNextDepth(graph, namedFunction(graph, 'POST')?.owner ?? '', id);
}

describe('independent frontend semantic benchmark clauses', () => {
  it('rejects a changed request selector and disabled guard', () => {
    expect(evaluate(ADDRESS, 'ts-address-callback-and-wire')).toEqual(
      expect.objectContaining({ status: 'supported' }),
    );
    expect(
      evaluate(
        ADDRESS.replace('lng:location.lng', 'lng:location.lat'),
        'ts-address-callback-and-wire',
      )?.status,
    ).toBe('unresolved');
    expect(evaluate(ADDRESS, 'ts-address-response-and-availability')?.status).toBe('supported');
    expect(
      evaluate(
        ADDRESS.replace('loading || isEligible !== true', 'loading && isEligible !== true'),
        'ts-address-response-and-availability',
      )?.status,
    ).toBe('unresolved');
  });

  it('rejects awaiting the helper and a swapped detail field', () => {
    expect(evaluate(INCOME, 'ts-income-callback-not-awaiting')?.status).toBe('supported');
    expect(
      evaluate(
        INCOME.replace('()=>{submitData();', 'async()=>{await submitData();'),
        'ts-income-callback-not-awaiting',
      )?.status,
    ).toBe('unresolved');
    expect(evaluate(INCOME, 'ts-income-response-to-onNext')?.status).toBe('supported');
    expect(
      evaluate(
        INCOME.replace(
          'adjustedIncome:incomeSection.details.adjustedIncome',
          'adjustedIncome:incomeSection.details.maxAdjustedIncome',
        ),
        'ts-income-response-to-onNext',
      )?.status,
    ).toBe('unresolved');
  });
  it('rejects swapped URL coordinates and changed failure status', () => {
    expect(evaluate(SERVER, 'ts-server-lineage-and-hops')).toEqual(
      expect.objectContaining({ status: 'supported' }),
    );
    expect(
      evaluate(SERVER.replace(`lon=\${lng}`, `lon=\${lat}`), 'ts-server-lineage-and-hops')?.status,
    ).toBe('unresolved');
    expect(evaluate(SERVER, 'ts-server-failure-and-output')?.status).toBe('supported');
    expect(
      evaluate(
        SERVER.replace("{error:'invalid'},{status:400}", "{error:'invalid'},{status:500}"),
        'ts-server-failure-and-output',
      )?.status,
    ).toBe('unresolved');
  });
});
