import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { profileCorporateSources } from './scan-profile-review-corporate';
import { profileSourceClauses } from './scan-profile-review-source';
import { profileTokenSources } from './scan-profile-review-tokens';

vi.mock(import('server-only'), () => ({}));

function fixture(file: string, content: string) {
  const index = indexSource({ path: `src/${file}.java`, language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const facts = extractLocalFacts(index, {
    host: 'host:test',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Missing test declaration');
  const bindings = collectJavaBindings([index], [unit]);
  return {
    ...scanFixture(),
    sources: [...facts.sources],
    semantic: [...(facts.semantic ?? [])],
    bindings: [
      ...bindings.calls.map((call) => ({
        ...call,
        argumentTypes: [...call.argumentTypes],
        guards: [...call.guards],
      })),
      ...bindings.values.map((value) => ({ ...value, guards: [...value.guards] })),
    ],
  };
}

const CONNECT = `class ConnectTokenService {
 boolean isEmpty(ConnectToken token) {
   return !StringUtils.hasText(token.email()) && !StringUtils.hasText(token.givenName())
     && !StringUtils.hasText(token.familyName()) && token.accesses().isEmpty();
 }
 boolean isPresent(ConnectToken token) { if (isEmpty(token)) { return false; } return true; }
}`;
const FLEET = `class FleetService {
 static final List<FleetAccountStatus> INACTIVE_FLEET_ACCOUNT_STATUSES = List.of(FleetAccountStatus.CANCELED, FleetAccountStatus.REJECTED, FleetAccountStatus.DISABLED);
 FleetAccount getAndValidateFleetAccountForOrdering(String fleetAccountId) {
   FleetAccount fleetAccount = getFleetAccount(fleetAccountId);
   if(INACTIVE_FLEET_ACCOUNT_STATUSES.contains(fleetAccount.status())) { throw new FleetAccountInactiveException(fleetAccountId, fleetAccount.status()); }
   if(fleetAccount.accountType() != FleetAccount.FleetAccountType.FLEET && fleetAccount.status() != FleetAccountStatus.APPROVED) { throw new FleetAccountNotApprovedException(fleetAccountId, fleetAccount.status()); }
   return fleetAccount;
 }
}`;

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'profile question source predicates',
  () => {
    it('requires Connect claim conjunction and lexical references while display survives', () => {
      const baseline = fixture('ConnectTokenService', CONNECT);
      expect(profileTokenSources(baseline).connectEmptyPredicate).toBe(true);
      const mutated = structuredClone(baseline);
      for (const node of mutated.semantic) {
        if (node.kind === 'semantic_node' && node.operator === '&&') node.operator = '||';
      }
      expect(profileTokenSources(mutated).connectEmptyPredicate).toBe(false);
      const missingReference = {
        ...baseline,
        bindings: baseline.bindings.filter(
          (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
        ),
      };
      expect(profileTokenSources(missingReference).connectEmptyPredicate).toBe(false);
    });

    it('requires the rejection branch to return false rather than merely name isEmpty', () => {
      const baseline = fixture('ConnectTokenService', CONNECT);
      expect(profileTokenSources(baseline).connectEmptyPredicate).toBe(true);
      const changed = {
        ...baseline,
        semantic: baseline.semantic.filter(
          (record) => record.kind !== 'semantic_edge' || record.relation !== 'consequent',
        ),
      };
      expect(profileTokenSources(changed).connectEmptyPredicate).toBe(false);
    });

    it('requires the full Fleet state condition and separate thrown outcomes', () => {
      const baseline = fixture('FleetService', FLEET);
      expect(profileCorporateSources(baseline).fleetStateGuards).toBe(true);
      expect(profileCorporateSources(baseline).fleetInactiveStatuses).toBe(true);
      const changed = structuredClone(baseline);
      for (const node of changed.semantic) {
        if (node.kind === 'semantic_node' && node.operator === '!=') node.operator = '==';
      }
      expect(profileCorporateSources(changed).fleetStateGuards).toBe(false);
      const missingThrows = {
        ...baseline,
        semantic: baseline.semantic.filter(
          (record) => record.kind !== 'semantic_edge' || record.relation !== 'value',
        ),
      };
      expect(profileCorporateSources(missingThrows).fleetStateGuards).toBe(false);
    });
    it('retains distinct same-named catch references in the complete Volvo helper', () => {
      const baseline = fixture(
        'VolvoIdClient',
        `class VolvoIdClient {
        VolvoIdUser getUserInfo(RestClient client, String path, String userAccessToken) {
          try {
            VolvoIdUser result = client.get().uri(path).header(AUTHORIZATION, BEARER_PREFIX + userAccessToken).accept(MediaType.APPLICATION_JSON).retrieve().toEntity(VolvoIdUser.class).getBody();
            if (result == null) throw new VolvoIdException("Received empty response from volvoId api");
            return result;
          } catch(BadRequest e) { throw new VolvoIdBadRequestException(e); }
            catch(RestClientException e) { throw new VolvoIdException("Unknown error (getUserInfo): ", e); }
        }
      }`,
      );
      expect(profileSourceClauses(baseline).volvoJsonRequest).toBe(true);
      const changed = {
        ...baseline,
        bindings: baseline.bindings.filter(
          (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
        ),
      };
      expect(profileSourceClauses(changed).volvoJsonRequest).toBe(false);
    });
  },
);
