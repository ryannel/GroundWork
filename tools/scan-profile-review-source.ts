import type { ScanDocument } from '@/domain/scan/scan.generated';

import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import { methodRecipe } from './scan-profile-review-method';

const EMPTY_OPTIONAL = 'Optional.empty()';

function volvoSource(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    issuerSelectsClient: methodRecipe(graph, ['VolvoIdClient', 'getUserInfo', 1], {
      branches: [
        {
          condition: 'trustedIssuerValidator.isVolvoIdKeycloakIssuer(userAccessToken)',
          returns: 'getUserInfo(keycloakClient,KEYCLOAK_USERINFO,userAccessToken)',
        },
      ],
      returns: ['getUserInfo(pingFederateClient,PING_FEDERATE_USERINFO,userAccessToken)'],
    }),
    volvoJsonRequest: methodRecipe(graph, ['VolvoIdClient', 'getUserInfo', 3], {
      initializers: {
        result:
          'client.get().uri(path).header(AUTHORIZATION,BEARER_PREFIX+userAccessToken).accept(MediaType.APPLICATION_JSON).retrieve().toEntity(VolvoIdUser.class).getBody()',
      },
      branches: [
        {
          condition: 'result==null',
          throws: 'VolvoIdException("Received empty response from volvoId api")',
        },
      ],
      returns: ['result'],
    }),
    sanitizationGuards: methodRecipe(graph, ['VolvoIdService', 'sanitizeUser'], {
      branches: [
        {
          condition:
            'user.givenName()!=null&&!user.givenName().matches(PatternConstants.NO_SPECIAL_CHARACTERS)',
          calls: ['user.toBuilder().givenName(null).build()'],
        },
        {
          condition:
            'user.familyName()!=null&&!user.familyName().matches(PatternConstants.NO_SPECIAL_CHARACTERS)',
          calls: ['user.toBuilder().familyName(null).build()'],
        },
        {
          condition:
            'user.address()!=null&&(!StringUtils.hasText(user.address().countryCode())||!StringUtils.hasText(user.address().locality())||!StringUtils.hasText(user.address().postalCode())||user.address().postalCode().length()>POSTAL_CODE_MAX_SIZE)',
          calls: ['user.toBuilder().address(null).build()'],
        },
      ],
      returns: ['user'],
    }),
  };
}

function claimsSource(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    oidcIssuerDecoderCache: methodRecipe(graph, ['OidcTokenDecoder', 'decode'], {
      initializers: { issuer: 'issuer(token)' },
      branches: [
        {
          condition: 'issuer==null||!trustedIssuers.contains(issuer)',
          returns: EMPTY_OPTIONAL,
        },
      ],
      calls: ['Optional.of(decoders.computeIfAbsent(issuer,decoderFactory).decode(token))'],
    }),
    entraIndividualFields: methodRecipe(graph, ['IndividualFactory', 'createFromEntraId'], {
      initializers: { id: 'idGenerator.generateId()' },
      returns: [
        'Individual.builder().id(id).emails(emailMapper.buildEmailsFromEntraId(entraIdUser)).phoneNumbers(List.of()).addresses(List.of()).roles(Set.of(Role.SIGNATORY,Role.AGENT)).firstName(entraIdUser.givenName()).lastName(entraIdUser.familyName()).entraId(entraIdUser.id()).gender(Gender.U).useOrgAddress(false).contactPreferences(Set.of()).build()',
      ],
    }),
  };
}

function consumerSource(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return {
    consumerBlankAndNullable: methodRecipe(graph, ['ConsumerService', 'getConsumer'], {
      branches: [{ condition: '!StringUtils.hasText(cdbId)', returns: EMPTY_OPTIONAL }],
      returns: ['Optional.ofNullable(cdbClient.getConsumer(cdbId))'],
    }),
    consumerContextValidation: methodRecipe(graph, ['ConsumerService', 'fetchConsumer', 3], {
      branches: [
        { condition: '!StringUtils.hasText(update.getCdbId())', returns: EMPTY_OPTIONAL },
        {
          condition: 'current!=null&&Objects.equals(current.cdbId(),update.getCdbId())',
          returns: EMPTY_OPTIONAL,
        },
        { condition: 'consumer.isEmpty()', throws: 'ConsumerNotFoundException(update.getCdbId())' },
      ],
      initializers: { consumer: 'context.getCdbConsumer(update.getCdbId())' },
      returns: ['consumer'],
    }),
  };
}

export function profileSourceClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  return { ...volvoSource(graph), ...claimsSource(graph), ...consumerSource(graph) };
}
