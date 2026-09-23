import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Conflict, InvalidInput, NotFound, statusFor } from '../server/errors.ts'

const cases: [unknown, number][] = [
  [new InvalidInput('x'), 400],
  [new NotFound('x'), 404],
  [new Conflict('x'), 409],
  [new Error('x'), 500],
]

for (const [error, status] of cases) {
  test(`statusFor maps ${(error as Error).constructor.name} to ${status}`, () => {
    assert.equal(statusFor(error), status)
  })
}

for (const [Class, name] of [[Conflict, 'Conflict'], [NotFound, 'NotFound'], [InvalidInput, 'InvalidInput']] as const) {
  test(`${name} is instanceof Error`, () => {
    assert.ok(new Class('x') instanceof Error)
  })
}
