# Security

## The Posture

A shipped mobile binary runs on a device the attacker owns. It can be pulled off the device, decompiled, patched, and run under a debugger or a proxy. So the client is **not** a trust boundary — it is hostile territory you are deploying into. Every security guarantee that matters is enforced server-side, behind the gateway (`references/data-and-contracts.md` → The Seam); the client's job is to handle credentials carefully and fail safe, not to keep secrets or enforce rules. This file is the Flutter idiom of the framework security canon (`docs/principles/quality/security.md`); when this file and the canon disagree, the canon wins and this file is the one to fix.

The recurring mistake is treating the app as trusted because it is "your" code. It stops being yours the moment it ships.

## No Secrets in the Binary

There is no secure place in the app bundle for a secret. API keys, signing keys, and shared credentials compiled into Dart — or passed via `--dart-define`, or baked into a `.env` asset — are all recoverable from the binary. The config seam already states this: no `.env` files baked in, no secrets in `--dart-define` (`references/data-and-contracts.md` → Configuration).

- A capability that needs a secret (a third-party API key, a server-to-server credential) lives **server-side**, behind a core endpoint the app calls with its user session. The surface never embeds a provider key — one owner per capability, keys stay server-side.
- `--dart-define` is for non-secret configuration only: the gateway base URL, build flavour, feature toggles.
- If the app appears to need a secret to call a third party directly, that call belongs on the server; route it through the core.

## Secure Storage for Tokens

Session and refresh tokens go in the platform keystore via `flutter_secure_storage`, which is backed by the iOS **Keychain** and the Android **Keystore**/EncryptedSharedPreferences. `SharedPreferences` and plain files are world-readable on a rooted/jailbroken device — they are never used for anything sensitive.

```dart
const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
);

Future<void> saveSession(String token) =>
    _storage.write(key: 'session_token', value: token);
```

- Tokens read out of secure storage are injected as a header by a single dio interceptor (`references/data-and-contracts.md` → dio Conventions), not stored in widget state or passed through constructors.
- `first_unlock_this_device` keeps the credential off device backups and off other devices; widen it only with a recorded reason.
- Clear secure storage on sign-out and on detected token invalidation — a lingering token is a credential waiting to be lifted.

## Transport and Certificate Pinning

All traffic is HTTPS; the dio client rejects plaintext. For an app handling sensitive data, pin the gateway's certificate (or its public-key/SPKI hash) so a user-installed or malicious root CA cannot transparently proxy the connection.

```dart
(dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
  final client = HttpClient();
  client.badCertificateCallback = (cert, host, port) =>
      _spkiSha256(cert) == _pinnedSpkiHash;  // pin to the key, not the leaf cert
  return client;
};
```

- Pin to the SPKI hash, not a specific leaf certificate, so routine certificate renewal does not brick the app; ship at least one backup pin for rotation.
- Pinning raises the bar against interception but is bypassable on a fully compromised device — it is defence in depth, not a substitute for server-side authorization.

## Deep Link and Intent Validation

Every `GoRoute` is deep-linkable, and a deep link is untrusted input from another app or a web page (`references/navigation.md` → Deep Links). Route parameters arriving cold are hostile until proven otherwise.

- Validate and parse path/query parameters in the view model that receives them; never assume a deep-linked id exists, belongs to the user, or is well-formed. The server authorizes the fetch — the client renders the result or an error state.
- Guard-sensitive destinations are protected by the central `redirect` (`references/navigation.md` → Auth Guards), so a deep link cannot skip authentication. Confirm new protected routes are covered by the guard, not by a per-screen check.
- Treat any token or credential arriving *in* a deep link (an OAuth callback) as single-use, validated server-side, and never logged.

## Biometric and Auth-Token Handling

Biometric unlock (`local_auth`) gates access to a credential already held in the keystore; it does not authenticate the user to the server. The server trusts the session token, not the fingerprint.

- Use biometrics to unlock or re-confirm before a sensitive action, then present the keystore-held token to the gateway. The biometric check is a local gate, not a replacement for a verified session.
- Token refresh runs through the dio interceptor against the auth provider; the app does not mint, sign, or verify tokens itself. Auth is boring technology — `docs/principles/system-design/identity-and-access.md`.
- On biometric failure or lockout, fall back to full re-authentication, never to an unguarded path.

## Obfuscation's Real Limits

`flutter build --obfuscate --split-debug-info` renames symbols and raises the cost of reverse engineering. It is a speed bump, not a control: it does not encrypt logic, hide strings reliably, or protect anything the earlier sections cover. An obfuscated binary still hands a determined attacker every embedded secret and every client-side check.

Ship it for the marginal friction, and depend on it for nothing. The actual protections are: no secrets in the binary, tokens in the keystore, TLS pinning, and authorization on the server.

## Security Review Checklist

For any PR touching auth, secure storage, the dio client, deep-link routes, or build config:

- [ ] No secret, key, or credential embedded in Dart, assets, or `--dart-define`
- [ ] Tokens and credentials in `flutter_secure_storage` — never `SharedPreferences` or plain files
- [ ] Secure storage cleared on sign-out and token invalidation
- [ ] Transport is HTTPS only; pinning present (with a backup pin) for sensitive apps
- [ ] Deep-link parameters validated in the view model; protected routes covered by the central guard
- [ ] No client-side check standing in for a server-side authorization decision
- [ ] Biometrics gate a keystore credential — they do not authenticate to the server
- [ ] Obfuscation enabled, and relied on for nothing
