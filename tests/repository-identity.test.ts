import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  deriveRepositoryIdentity, githubRepository, hasCredentials, identitySlug, isProvisional, provisionalIdentity, repositoryIdentity,
  repositoryName, stripCredentials,
} from '../src/data/repository-identity.ts'

test('github forms collapse to lower-case owner/name', () => {
  const forms = [
    'https://github.com/Acme/API.git', 'ssh://git@github.com/acme/api', 'git@github.com:acme/api.git', 'github.com/acme/api/', 'Acme/API',
    'https://user:pass@github.com/acme/api.git', 'https://github.com:443/acme/api', 'ssh://git@github.com:22/Acme/API.git',
    'http://github.com:80/acme/api/', 'GitHub.com/ACME/api.GIT', 'git://github.com/acme/api.git',
  ]
  for (const value of forms) {
    assert.equal(repositoryIdentity(value), 'acme/api', value)
    assert.equal(githubRepository(value), 'acme/api', value)
  }
})

test('a port github does not serve keeps its own identity', () => {
  // HEAD dropped every port on a github host, so a proxy or tunnel collapsed onto the repository it fronts.
  assert.equal(repositoryIdentity('ssh://git@github.com:2222/acme/api.git'), 'github.com:2222/acme/api')
  assert.equal(repositoryIdentity('https://github.com:8443/acme/api.git'), 'github.com:8443/acme/api')
  assert.equal(repositoryIdentity('ssh://git@ssh.github.com:2222/acme/api.git'), 'ssh.github.com:2222/acme/api')
  assert.notEqual(repositoryIdentity('ssh://git@github.com:2222/acme/api.git'), repositoryIdentity('acme/api'))
  // Such an identity is not the GitHub.com repository, and it normalises to itself so it survives a round trip.
  assert.equal(githubRepository('https://github.com:8443/acme/api.git'), undefined)
  for (const identity of ['github.com:2222/acme/api', 'github.com:8443/acme/api', 'ssh.github.com:2222/acme/api']) {
    assert.equal(repositoryIdentity(identity), identity, identity)
  }
  // Path case is kept, as it is for every other host-prefixed identity; only github.com itself lower-cases it.
  assert.equal(repositoryIdentity('https://github.com:8443/Acme/API.git'), 'github.com:8443/Acme/API')
  // Every port github does serve still folds: the scheme's default, and ssh.github.com's documented 443 endpoint.
  for (const value of [
    'ssh://git@github.com:22/acme/api.git', 'https://github.com:443/acme/api', 'http://github.com:80/acme/api',
    'git://github.com:9418/acme/api.git', 'ssh://git@ssh.github.com:443/acme/api.git', 'ssh.github.com:443/acme/api',
    'ssh://git@ssh.github.com:22/acme/api.git', 'ssh.github.com/acme/api',
  ]) assert.equal(repositoryIdentity(value), 'acme/api', value)
})

test('the other spellings of github.com are the same repository', () => {
  const forms = [
    'https://www.github.com/Acme/API.git', 'ssh://git@ssh.github.com:443/acme/api.git', 'git@ssh.github.com:acme/api.git',
    'git@github.com:/acme/api.git', 'https://github.com/acme/api.git?tab=readme', 'https://github.com/acme/api#readme',
    'git://github.com:9418/acme/api.git',
  ]
  for (const value of forms) {
    assert.equal(repositoryIdentity(value), 'acme/api', value)
    assert.equal(githubRepository(value), 'acme/api', value)
  }
})

test('git:// uses its own default port, and other ports stay part of the identity', () => {
  assert.equal(repositoryIdentity('git://ghe.example.com/acme/api.git'), 'ghe.example.com/acme/api')
  assert.equal(repositoryIdentity('git://ghe.example.com:9418/acme/api.git'), 'ghe.example.com/acme/api')
  // Port 22 is not git://'s default, so it names a different endpoint rather than repeating the implicit one.
  assert.equal(repositoryIdentity('git://ghe.example.com:22/acme/api.git'), 'ghe.example.com:22/acme/api')
  assert.equal(repositoryIdentity('ssh://git@ghe.example.com:9418/acme/api.git'), 'ghe.example.com:9418/acme/api')
})

test('bracketed ipv6 hosts, queries and fragments normalise', () => {
  assert.equal(repositoryIdentity('ssh://git@[2001:db8::1]:22/acme/api.git'), '[2001:db8::1]/acme/api')
  assert.equal(repositoryIdentity('ssh://git@[2001:DB8::1]/acme/api'), '[2001:db8::1]/acme/api')
  assert.equal(repositoryIdentity('ssh://git@[2001:db8::1]:2222/acme/api.git'), '[2001:db8::1]:2222/acme/api')
  assert.equal(repositoryIdentity('https://ghe.example.com/acme/api.git?ref=main#top'), 'ghe.example.com/acme/api')
})

test('a stored identity normalises to itself', () => {
  for (const identity of [
    'acme/api', 'ghe.example.com/acme/api', 'ghe.example.com:2222/acme/api', 'gitlab.com/group/sub/project',
    'local:price-engine', '[2001:db8::1]/acme/api',
  ]) assert.equal(repositoryIdentity(identity), identity, identity)
})

test('every url form of one enterprise repository produces one identity', () => {
  const forms = [
    'git@ghe.example.com:acme/api.git', 'ssh://git@ghe.example.com/acme/api', 'ssh://git@ghe.example.com:22/acme/api.git',
    'https://ghe.example.com/acme/api/', 'https://ghe.example.com:443/acme/api.git', 'ghe.example.com/acme/api',
    'https://build:token@ghe.example.com/acme/api.git',
  ]
  for (const value of forms) {
    assert.equal(repositoryIdentity(value), 'ghe.example.com/acme/api', value)
    assert.equal(githubRepository(value), undefined, value)
  }
  // The host prefix is what keeps an enterprise repository from colliding with the GitHub.com one of the same name.
  assert.notEqual(repositoryIdentity('git@ghe.example.com:acme/api.git'), repositoryIdentity('acme/api'))
  assert.equal(repositoryIdentity('ssh://git@ghe.example.com:2222/acme/api.git'), 'ghe.example.com:2222/acme/api')
})

test('nested groups survive and path case is kept off github.com', () => {
  assert.equal(repositoryIdentity('https://gitlab.com/group/sub/project.git'), 'gitlab.com/group/sub/project')
  assert.equal(repositoryIdentity('git@gitlab.com:group/sub/project.git'), 'gitlab.com/group/sub/project')
  assert.equal(repositoryIdentity('https://GHE.Example.com/Acme/API.git'), 'ghe.example.com/Acme/API')
  assert.equal(repositoryIdentity('git@ghe.example.com:Acme/API.git'), 'ghe.example.com/Acme/API')
})

test('credential helpers keep their existing behaviour', () => {
  assert.equal(hasCredentials('https://user:pass@gitlab.com/group/project.git'), true)
  assert.equal(hasCredentials('https://gitlab.com/group/project.git'), false)
  assert.equal(stripCredentials('git@gitlab.com:group/project.git'), 'git@gitlab.com:group/project.git')
  assert.equal(stripCredentials('https://user:pass@gitlab.com/group/project.git'), 'https://gitlab.com/group/project.git')
})

test('local paths are returned unchanged', () => {
  assert.equal(repositoryIdentity('/tmp/work/repo'), '/tmp/work/repo')
  assert.equal(repositoryIdentity('./repo'), './repo')
  assert.equal(repositoryIdentity('~/work/repo'), '~/work/repo')
  assert.equal(githubRepository('/tmp/acme/api'), undefined)
  assert.equal(githubRepository('gitlab.com/group'), undefined)
})

test('a clone without origin gets a provisional identity and a warning', () => {
  const derived = deriveRepositoryIdentity(null, '/Users/me/Workspace/Price Engine/')
  assert.equal(derived.id, 'local:price-engine')
  assert.equal(derived.provisional, true)
  assert.equal(derived.origin, null)
  assert.match(derived.warning!, /no origin remote/)
  assert.equal(isProvisional(derived.id), true)
  assert.equal(provisionalIdentity('/Users/me/Workspace/.hidden repo'), 'local:hidden-repo')
  const configured = deriveRepositoryIdentity('  git@github.com:acme/api.git  ', '/Users/me/api')
  assert.deepEqual(configured, { id: 'acme/api', origin: 'git@github.com:acme/api.git', provisional: false })
  assert.equal(isProvisional(configured.id), false)
})

test('identity names and slugs are document safe', () => {
  assert.equal(repositoryName('volvo-cars/price-engine'), 'price-engine')
  assert.equal(repositoryName('ghe.example.com/acme/api'), 'api')
  assert.equal(repositoryName('local:price-engine'), 'price-engine')
  assert.equal(identitySlug('volvo-cars/price-engine'), 'volvo-cars__price-engine')
  assert.equal(identitySlug('ghe.example.com/Acme/API'), 'ghe_dexample_dcom__Acme__API')
  assert.equal(identitySlug('local:price-engine'), 'local_cprice-engine')
  for (const identity of ['volvo-cars__price-engine', 'ghe_dexample_dcom__Acme__API', 'local_cprice-engine']) {
    assert.match(identity, /^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
  }
})

test('a slug is a valid document id even for an identity that spells a reserved property', () => {
  // `git remote add origin constructor` is a legal, if odd, remote, and its identity would be the bare word.
  const pattern = /^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/
  for (const identity of ['constructor', 'prototype', '__proto__', 'Constructor', 'constructors']) {
    assert.match(identitySlug(identity), pattern, identity)
  }
  assert.equal(new Set(['constructor', 'prototype', '__proto__', 'Constructor', 'constructors'].map(identitySlug)).size, 5)
  // Only the reserved spellings take the escape hatch; a name that merely contains one is unchanged.
  assert.equal(identitySlug('constructors'), 'constructors')
  assert.equal(identitySlug('acme/constructor'), 'acme__constructor')
})

test('a slug never merges two repositories into one project id', () => {
  // Collapsing every separator to `-` mapped both of these onto `foo-bar-a-b`, and the slug qualifies catalog IDs.
  assert.notEqual(identitySlug('foo.bar/a/b'), identitySlug('foo-bar.a/b'))
  assert.notEqual(identitySlug('volvo-cars/price-engine'), identitySlug('volvo/cars-price-engine'))
  assert.notEqual(identitySlug('acme/api'), identitySlug('local:acme/api'))
  const identities = [
    'foo.bar/a/b', 'foo-bar.a/b', 'volvo-cars/price-engine', 'volvo/cars-price-engine', 'ghe.example.com:2222/acme/api',
    'ghe.example.com/acme/api', 'local:acme-api', 'acme/api', 'acme/a_pi', 'acme/a.pi', '[2001:db8::1]/acme/api', '/Users/me/work/repo',
  ]
  assert.equal(new Set(identities.map(identitySlug)).size, identities.length)
  for (const identity of identities) {
    assert.match(identitySlug(identity), /^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/, identity)
  }
})
