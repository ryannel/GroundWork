import { describe, expect, it } from 'vitest';

import { dotnetPackage } from './scan-dotnet-setup';

function metadata(source = 'https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.402/sdk.tar.gz') {
  return {
    'latest-sdk': '10.0.402',
    releases: [
      {
        sdks: [
          {
            version: '10.0.402',
            files: [{ name: 'sdk.tar.gz', rid: 'osx-arm64', url: source, hash: '0'.repeat(128) }],
          },
        ],
      },
    ],
  };
}

describe('managed compiler-only .NET metadata', () => {
  it('selects the official platform SDK and retains its archive SHA-512', () => {
    expect(dotnetPackage(metadata(), 'osx-arm64')).toEqual({
      version: '10.0.402',
      source: 'https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.402/sdk.tar.gz',
      hash: '0'.repeat(128),
    });
    expect(() => dotnetPackage(metadata(), 'linux-x64')).toThrow(/unavailable/u);
  });
  it('rejects off-origin artifacts and unpinned or absent SDK metadata', () => {
    expect(() => dotnetPackage(metadata('https://example.test/sdk.tar.gz'), 'osx-arm64')).toThrow(
      /Untrusted/u,
    );
    expect(() => dotnetPackage({ 'latest-sdk': '11.0.100' }, 'osx-arm64')).toThrow(/stable/u);
    expect(() => dotnetPackage({}, 'osx-arm64')).toThrow(/Missing/u);
  });
});
