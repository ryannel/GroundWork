import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { profileIndividualComposition } from './scan-profile-review-individual';

vi.mock(import('server-only'), () => ({}));

const CONTEXT = `import java.util.Optional;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
class FactoryContext {
 Object userIdentity;
 CompletableFuture<Optional<Object>> volvoIdUserFuture;
 Map<String, CompletableFuture<Optional<Object>>> cdbConsumerFutures;
 Function<String, Optional<Object>> cdbConsumerLoader;
 FactoryContext(Object market, Object userIdentity, Function<String,Optional<Object>> volvoIdUserLoader, Function<String,Optional<Object>> cdbConsumerLoader) {
   this.volvoIdUserFuture = userIdentity instanceof UserIdentity.VolvoId(String token)
     ? ContextAwareCompletableFuture.supplyAsyncWithContext(() -> volvoIdUserLoader.apply(token))
     : CompletableFuture.completedFuture(Optional.empty());
 }
 Optional<Object> getConnectToken() {
   return userIdentity instanceof UserIdentity.Connect(ConnectToken token) ? Optional.of(token) : Optional.empty();
 }
 Optional<Object> getEntraIdUser() {
   return userIdentity instanceof UserIdentity.EntraId(EntraIdUser user) ? Optional.of(user) : Optional.empty();
 }
 Optional<Object> getVolvoIdUser() {
   try { return volvoIdUserFuture.join(); } catch(Exception e) { return Optional.empty(); }
 }
 Optional<Object> getCdbConsumer(String cdbId) {
   if (!StringUtils.hasText(cdbId)) return Optional.empty();
   try { return cdbConsumerFuture(cdbId).join(); } catch(Exception e) { return Optional.empty(); }
 }
 CompletableFuture<Optional<Object>> cdbConsumerFuture(String cdbId) {
   return cdbConsumerFutures.computeIfAbsent(cdbId, id -> ContextAwareCompletableFuture.supplyAsyncWithContext(() -> cdbConsumerLoader.apply(id)));
 }
}`;

function fixture(content = CONTEXT, file = 'FactoryContext') {
  const index = indexSource({
    path: `src/${file}.java`,
    language: 'java',
    content,
  });
  expect(index.diagnostics).toEqual([]);
  const facts = extractLocalFacts(index, {
    host: 'host:test',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Missing declaration fixture');
  const bindings = collectJavaBindings([index], [unit]);
  return {
    ...scanFixture(),
    sources: [...new Map(facts.sources.map((source) => [source.id, source])).values()],
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

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'individual source composition',
  () => {
    it('proves identity alternatives, captured Volvo callback and CDB cache-key lineage independently', () => {
      const document = fixture();
      expect(profileIndividualComposition(document)).toMatchObject({
        connectIdentity: true,
        entraIdentity: true,
        volvoIdentityFuture: true,
        volvoFutureJoin: true,
        blankCdbSkipped: true,
        cdbFutureJoin: true,
        cdbCacheById: true,
        supported: false,
      });
      for (const node of document.semantic) {
        if (node.kind === 'semantic_node') node.syntax = 'misleading unchanged display';
      }
      expect(profileIndividualComposition(document).cdbCacheById).toBe(true);
    });

    it('rejects callback/capture, identity branch and source-reference mutations while display survives', () => {
      const baseline = fixture();
      for (const [relation, clause] of [
        ['callback', 'volvoIdentityFuture'],
        ['captures', 'volvoIdentityFuture'],
        ['otherwise', 'connectIdentity'],
        ['reference', 'cdbCacheById'],
      ] as const) {
        const changed = structuredClone(baseline);
        if (relation === 'reference') {
          changed.bindings = changed.bindings.filter(
            (binding) => binding.kind !== 'java_value_binding' || binding.relation !== relation,
          );
        } else {
          changed.semantic = changed.semantic.filter(
            (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
          );
        }
        expect(profileIndividualComposition(baseline)[clause]).toBe(true);
        expect(profileIndividualComposition(changed)[clause]).toBe(false);
      }
    });
  },
);

const FALLBACKS = `import java.util.List;
import java.util.Set;
class EntityFactory {
 static <V> V nullable(V... values) {
  for (V value : values) { if (value != null) return value; } return null;
 }
 static <V> List<V> nullableOrEmpty(List<V>... values) {
  for (List<V> value : values) { if (value != null && !value.isEmpty()) return value; } return List.of();
 }
 static <V> Set<V> nullableOrEmpty(Set<V>... values) {
  for (Set<V> value : values) { if (value != null && !value.isEmpty()) return value; } return Set.of();
 }
}`;

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'fallback loop proof ordering',
  () => {
    it('uses typed child roles after hash-ID page ordering and still requires lexical lineage', () => {
      const document = fixture(FALLBACKS, 'EntityFactory');
      expect(profileIndividualComposition(document).fallbackHelperDeclarations).toBe(true);
      document.semantic.sort((left, right) => left.id.localeCompare(right.id));
      expect(profileIndividualComposition(document).fallbackHelperDeclarations).toBe(true);
      const missing = structuredClone(document);
      missing.semantic = missing.semantic.filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'ast_child',
      );
      expect(profileIndividualComposition(missing).fallbackHelperDeclarations).toBe(false);
      const unbound = structuredClone(document);
      unbound.bindings = [];
      expect(profileIndividualComposition(unbound).fallbackHelperDeclarations).toBe(false);
    });
  },
);

const CREATE = `class IndividualFactory {
 Individual mapCreate(IndividualRequest request, FactoryContext context) {
  String id = idGenerator.generateId();
  Optional<CdbConsumer> cdbConsumer = consumerService.fetchConsumer(request, context);
  Optional<VolvoIdUser> volvoIdUser = request.getRoles().contains(Role.SIGNATORY) ? context.getVolvoIdUser() : Optional.empty();
  Optional<CdbPerson> cdbPerson = cdbConsumer.map(CdbConsumer::person);
  return new Individual(id,
   nullableOrEmpty(emailMapper.buildEmails(request.getEmails()),emailMapper.buildEmailsFromVolvoId(volvoIdUser),emailMapper.buildEmailsFromCdb(cdbConsumer)),
   nullableOrEmpty(phoneMapper.buildPhoneNumbers(request.getPhoneNumbers()),phoneMapper.buildPhonesFromVolvoId(volvoIdUser),phoneMapper.buildPhonesFromCdb(cdbConsumer)),
   nullableOrEmpty(addressMapper.buildAddresses(request.getAddresses()),addressMapper.buildAddressesFromVolvoId(volvoIdUser,context.getMarket()),addressMapper.buildAddressesFromCdb(cdbConsumer,context.getMarket())),
   request.getRoles(),request.getCdbId(),request.getCdbTcId(),externalUserIdFactory.create(request.getExternalUserId(),context),
   nullable(request.getLanguage(),volvoIdUser.map(VolvoIdUser::getLanguageEnum).orElse(null),cdbConsumer.map(CdbConsumer::getLanguageEnum).orElse(null)),
   nullable(request.getFirstName(),volvoIdUser.map(VolvoIdUser::givenName).orElse(null),cdbPerson.map(CdbPerson::firstName).orElse(null)),
   nullable(request.getMiddleName(),cdbPerson.map(CdbPerson::additionalName).orElse(null)),
   nullable(request.getLastName(),volvoIdUser.map(VolvoIdUser::familyName).orElse(null),cdbPerson.map(CdbPerson::surname).orElse(null)),
   nullable(volvoIdUser.map(VolvoIdUser::id).orElse(null),request.getVolvoId()),null,request.getSpinPersonNumber(),
   nullable(request.getTitle(),cdbPerson.map(CdbPerson::titleDescription).orElse(null)),
   nullable(request.getGender(),volvoIdUser.map(VolvoIdUser::getGenderEnum).orElse(null),cdbPerson.map(CdbPerson::getGenderEnum).orElse(null),Gender.U),
   nullable(request.getDateOfBirth(),volvoIdUser.map(VolvoIdUser::getDateOfBirth).orElse(null),cdbPerson.map(CdbPerson::getDateOfBirth).orElse(null)),
   Boolean.TRUE.equals(nullable(request.getUseOrgAddress(),false)),
   nullable(request.getInitials(),cdbPerson.map(CdbPerson::initials).orElse(null)),
   contactPreferenceMapper.buildContactPreferences(request.getContactPreferences()),request.getDateOfConsent(),consentInfoMapper.map(request.getConsentInfo()));
 }
}`;

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'individual constructor roles',
  () => {
    it('requires all constructor positions and request/Volvo/CDB lexical origins', () => {
      const baseline = fixture(CREATE, 'IndividualFactory');
      expect(profileIndividualComposition(baseline)).toMatchObject({
        createFieldOrder: true,
        createSourceLineage: true,
      });
      const changed = structuredClone(baseline);
      const construction = changed.semantic.find(
        (node) => node.kind === 'semantic_node' && node.nodeKind === 'construct',
      );
      if (!construction) throw new Error('Missing Individual construction');
      for (const edge of changed.semantic) {
        if (
          edge.kind === 'semantic_edge' &&
          edge.from === construction.id &&
          edge.relation === 'argument'
        ) {
          if (edge.position === 1) edge.position = 2;
          else if (edge.position === 2) edge.position = 1;
        }
      }
      expect(profileIndividualComposition(changed).createFieldOrder).toBe(false);
      const unrelated = structuredClone(baseline);
      unrelated.bindings = unrelated.bindings.filter(
        (binding) => binding.kind !== 'java_value_binding' || binding.relation !== 'reference',
      );
      expect(profileIndividualComposition(unrelated).createSourceLineage).toBe(false);
    });

    it('rejects changed signatory gate and mapper source while retained syntax stays original', () => {
      const baseline = fixture(CREATE, 'IndividualFactory');
      const changed = structuredClone(baseline);
      for (const node of changed.semantic) {
        if (
          node.kind === 'semantic_node' &&
          node.nodeKind === 'member' &&
          node.name === 'SIGNATORY'
        ) {
          node.name = 'SOLD_TO';
        }
      }
      expect(profileIndividualComposition(baseline).createSourceLineage).toBe(true);
      expect(profileIndividualComposition(changed).createSourceLineage).toBe(false);
    });
  },
);
