/** Shared error taxonomy for the runtime. HTTP and MCP map these to status codes; everything else is a server fault. */
export class Conflict extends Error {}
export class NotFound extends Error {}
export class InvalidInput extends Error {}

export function statusFor(error: unknown) {
  if (error instanceof Conflict) return 409
  if (error instanceof NotFound) return 404
  if (error instanceof InvalidInput) return 400
  return 500
}
