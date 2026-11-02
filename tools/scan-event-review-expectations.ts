export const GUARDS = [
  'kafkaTemplate==null||!eventSettings.enabled()',
  'individual==null||individual.cdbId()==null',
  'individual.consentInfo()==null',
  '!hasConsentInfoChanged(previous,individual)',
];
export const FIELDS = [
  ['volvoId', 'individual.volvoId()'],
  ['cdbId', 'individual.cdbId()'],
  ['countryCode', 'countryCode'],
  ['consentType', 'consentInfo.consentType()'],
  ['consented', 'consentInfo.consentGranted()'],
  ['timestamp', 'consentInfo.dateOfConsent()'],
  ['contactPreferences', 'consentInfo.contactPreferences()'],
] as const;
