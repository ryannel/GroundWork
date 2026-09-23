import assert from 'node:assert/strict'
import { test } from 'node:test'
import { githubRepository, hasCredentials, repositoryIdentity, stripCredentials } from '../src/data/repository-identity.ts'

test('github forms collapse to lower-case owner/name', () => {
  for (const value of ['https://github.com/Acme/API.git', 'ssh://git@github.com/acme/api', 'git@github.com:acme/api.git', 'github.com/acme/api/', 'Acme/API', 'https://x-access-token:ghs_secret@github.com/acme/api.git']) {
    assert.equal(repositoryIdentity(value), 'acme/api', value)
    assert.equal(githubRepository(value), 'acme/api', value)
  }
})

test('non-github urls lose credentials and .git but keep host and path', () => {
  assert.equal(repositoryIdentity('https://oauth2:glpat-secret@gitlab.com/group/project.git'), 'https://gitlab.com/group/project')
  assert.equal(githubRepository('https://gitlab.com/group/project'), undefined)
  assert.equal(hasCredentials('https://oauth2:glpat-secret@gitlab.com/group/project.git'), true)
  assert.equal(hasCredentials('https://gitlab.com/group/project.git'), false)
  assert.equal(stripCredentials('git@gitlab.com:group/project.git'), 'git@gitlab.com:group/project.git')
})

test('local paths are returned unchanged', () => {
  assert.equal(repositoryIdentity('/tmp/work/repo'), '/tmp/work/repo')
  assert.equal(repositoryIdentity('./repo'), './repo')
  assert.equal(githubRepository('/tmp/acme/api'), undefined)
})
