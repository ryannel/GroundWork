import type { SemanticNode } from '@/domain/scan/scan.generated';

import { profileMethod, profileReturned, type ProfileGraph } from './scan-profile-review-graph';
import {
  individualInitialisers,
  individualNodes,
  individualRecipe,
  individualReferences,
} from './scan-profile-review-individual-atoms';
import { targets } from './scan-semantic-query';

type Mode = 'Create' | 'Update' | 'Patch';
const SCALARS = [
  ['Language', 'language', 'getLanguageEnum', 'cdbConsumer', 'CdbConsumer', 'getLanguageEnum'],
  ['FirstName', 'firstName', 'givenName', 'cdbPerson', 'CdbPerson', 'firstName'],
  ['MiddleName', 'middleName', '', 'cdbPerson', 'CdbPerson', 'additionalName'],
  ['LastName', 'lastName', 'familyName', 'cdbPerson', 'CdbPerson', 'surname'],
  ['Title', 'title', '', 'cdbPerson', 'CdbPerson', 'titleDescription'],
  ['Gender', 'gender', 'getGenderEnum', 'cdbPerson', 'CdbPerson', 'getGenderEnum'],
  ['DateOfBirth', 'dateOfBirth', 'getDateOfBirth', 'cdbPerson', 'CdbPerson', 'getDateOfBirth'],
  ['Initials', 'initials', '', 'cdbPerson', 'CdbPerson', 'initials'],
] as const;

function mapped(variable: string, type: string, method: string): string {
  return `${variable}.map(${type}::${method}).orElse(null)`;
}

function scalarRecipes(mode: Mode): ReadonlyMap<string, string> {
  const request = mode === 'Create' ? 'request' : 'updates';
  return new Map(
    SCALARS.map(([getter, field, volvo, variable, type, cdb]) => {
      const values = [`${request}.get${getter}()`];
      if (mode === 'Patch') values.push(`current.${field}()`);
      if (volvo !== '' && !(mode === 'Patch' && field === 'language')) {
        values.push(mapped('volvoIdUser', 'VolvoIdUser', volvo));
      }
      values.push(mapped(variable, type, cdb));
      if (field === 'gender') values.push('Gender.U');
      return [field, `nullable(${values.join(',')})`];
    }),
  );
}

function contactRecipes(mode: Mode): readonly string[] {
  if (mode === 'Patch') {
    return [
      'nullableOrEmpty(requestEmails,current.emails(),volvoIdEmails,cdbEmails)',
      'nullableOrEmpty(requestPhones,current.phoneNumbers(),volvoIdPhones,cdbPhones)',
      'nullableOrEmpty(requestAddresses,current.addresses(),volvoIdAddresses,cdbAddresses)',
    ];
  }
  const request = mode === 'Create' ? 'request' : 'updates';
  return [
    `nullableOrEmpty(emailMapper.buildEmails(${request}.getEmails()),emailMapper.buildEmailsFromVolvoId(volvoIdUser),emailMapper.buildEmailsFromCdb(cdbConsumer))`,
    `nullableOrEmpty(phoneMapper.buildPhoneNumbers(${request}.getPhoneNumbers()),phoneMapper.buildPhonesFromVolvoId(volvoIdUser),phoneMapper.buildPhonesFromCdb(cdbConsumer))`,
    `nullableOrEmpty(addressMapper.buildAddresses(${request}.getAddresses()),addressMapper.buildAddressesFromVolvoId(volvoIdUser,context.getMarket()),addressMapper.buildAddressesFromCdb(cdbConsumer,context.getMarket()))`,
  ];
}

function constructorRecipes(mode: Mode): readonly string[] {
  const request = mode === 'Create' ? 'request' : 'updates';
  const patch = mode === 'Patch';
  const scalars = scalarRecipes(mode);
  const scalar = (field: string) => scalars.get(field) ?? '';
  const consent = {
    Create: 'consentInfoMapper.map(request.getConsentInfo())',
    Update: 'nullable(updatedConsentInfo,current.consentInfo())',
    Patch: 'nullable(requestConsentInfo,current.consentInfo())',
  };
  const preserve = (getter: string, field: string) =>
    patch ? `nullable(${request}.get${getter}(),current.${field}())` : `${request}.get${getter}()`;
  const external =
    mode === 'Create'
      ? 'externalUserIdFactory.create(request.getExternalUserId(),context)'
      : `externalUserIdFactory.${mode.toLowerCase()}(current.externalUserId(),updates.getExternalUserId(),context)`;
  return [
    mode === 'Create' ? 'id' : 'current.id()',
    ...contactRecipes(mode),
    patch ? 'roles' : `${request}.getRoles()`,
    preserve('CdbId', 'cdbId'),
    preserve('CdbTcId', 'cdbTcId'),
    external,
    ...['language', 'firstName', 'middleName', 'lastName'].map(scalar),
    `nullable(${mapped('volvoIdUser', 'VolvoIdUser', 'id')},${request}.getVolvoId()${patch ? ',current.volvoId()' : ''})`,
    mode === 'Create' ? 'null' : 'current.entraId()',
    preserve('SpinPersonNumber', 'spinPersonNumber'),
    scalar('title'),
    scalar('gender'),
    scalar('dateOfBirth'),
    `Boolean.TRUE.equals(nullable(${request}.getUseOrgAddress(),${patch ? 'current.useOrgAddress()' : 'false'}))`,
    scalar('initials'),
    patch
      ? 'nullableOrEmpty(requestContactPreferences,current.contactPreferences())'
      : `contactPreferenceMapper.buildContactPreferences(${request}.getContactPreferences())`,
    preserve('DateOfConsent', 'dateOfConsent'),
    consent[mode],
  ];
}

function orderedFields(graph: ProfileGraph, owner: SemanticNode, mode: Mode): boolean {
  const constructors = individualNodes(graph, owner).filter(
    (node) =>
      node.nodeKind === 'construct' && targets(graph, node, 'callee')[0]?.name === 'Individual',
  );
  const construction = constructors[0];
  if (constructors.length !== 1 || !construction) return false;
  const actual = targets(graph, construction, 'argument');
  const expected = constructorRecipes(mode);
  return (
    profileReturned(graph, owner, construction.source) &&
    actual.length === expected.length &&
    actual.every((argument, index) => individualRecipe(graph, argument) === expected[index])
  );
}

function localRecipes(mode: Mode): ReadonlyMap<string, string> {
  const request = mode === 'Create' ? 'request' : 'updates';
  const roleSource = mode === 'Patch' ? 'roles' : `${request}.getRoles()`;
  const inputs = mode === 'Create' ? 'request,context' : 'current,updates,context';
  const recipes = new Map([
    ['cdbConsumer', `consumerService.fetchConsumer(${inputs})`],
    ['cdbPerson', 'cdbConsumer.map(CdbConsumer::person)'],
    [
      'volvoIdUser',
      `${roleSource}.contains(Role.SIGNATORY)?context.getVolvoIdUser()?Optional.empty()`,
    ],
  ]);
  if (mode === 'Create') recipes.set('id', 'idGenerator.generateId()');
  if (mode === 'Update') {
    recipes.set('updatedConsentInfo', 'consentInfoMapper.map(updates.getConsentInfo())');
  }
  if (mode !== 'Patch') return recipes;
  recipes.set('roles', 'nullableOrEmpty(updates.getRoles(),current.roles())');
  for (const [suffix, mapper, getter, build, volvo, cdb] of [
    [
      'Emails',
      'emailMapper',
      'Emails',
      'buildEmails',
      'buildEmailsFromVolvoId',
      'buildEmailsFromCdb',
    ],
    [
      'Phones',
      'phoneMapper',
      'PhoneNumbers',
      'buildPhoneNumbers',
      'buildPhonesFromVolvoId',
      'buildPhonesFromCdb',
    ],
    [
      'Addresses',
      'addressMapper',
      'Addresses',
      'buildAddresses',
      'buildAddressesFromVolvoId',
      'buildAddressesFromCdb',
    ],
  ] as const) {
    const market = suffix === 'Addresses' ? ',context.getMarket()' : '';
    recipes.set(`request${suffix}`, `${mapper}.${build}(updates.get${getter}())`);
    recipes.set(`volvoId${suffix}`, `${mapper}.${volvo}(volvoIdUser${market})`);
    recipes.set(`cdb${suffix}`, `${mapper}.${cdb}(cdbConsumer${market})`);
  }
  recipes.set(
    'requestContactPreferences',
    'contactPreferenceMapper.buildContactPreferences(updates.getContactPreferences())',
  );
  recipes.set('requestConsentInfo', 'consentInfoMapper.map(updates.getConsentInfo())');
  return recipes;
}

function localSources(graph: ProfileGraph, owner: SemanticNode, mode: Mode): boolean {
  const actual = individualInitialisers(graph, owner);
  const parameters = targets(graph, owner, 'parameter');
  const types = parameters.map((parameter) => targets(graph, parameter, 'declared_type')[0]?.name);
  const expected =
    mode === 'Create'
      ? ['IndividualRequest', 'FactoryContext']
      : ['Individual', 'IndividualRequest', 'FactoryContext'];
  if (owner.returnType !== 'Individual' || types.join(',') !== expected.join(',')) return false;
  return (
    [...localRecipes(mode)].every(
      ([name, recipe]) => individualRecipe(graph, actual.get(name)) === recipe,
    ) && individualReferences(graph, owner)
  );
}

/** Every constructor position, field-specific priority and local mapper origin stays source-bound. */
export function profileIndividualFields(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  return Object.fromEntries(
    (['Create', 'Update', 'Patch'] as const).flatMap((mode) => {
      const owners = profileMethod(graph, 'IndividualFactory', `map${mode}`);
      const owner = owners[0];
      return [
        [
          `${mode.toLowerCase()}FieldOrder`,
          owners.length === 1 && owner !== undefined && orderedFields(graph, owner, mode),
        ],
        [
          `${mode.toLowerCase()}SourceLineage`,
          owners.length === 1 && owner !== undefined && localSources(graph, owner, mode),
        ],
      ];
    }),
  );
}
