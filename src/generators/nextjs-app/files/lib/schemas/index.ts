import { z } from "zod";

/**
 * Zod schemas barrel.
 *
 * Define domain schemas in this directory and re-export them here so
 * components import from `@/lib/schemas` — never from individual files.
 *
 * The example below is a generic health/status payload. Replace it with
 * your real domain schemas (e.g. `export { userSchema, type User } from './user';`).
 */

/** Example schema: a generic API status/health envelope. */
export const statusSchema = z.object({
  status: z.string(),
  timestamp: z.string().optional(),
});

export type Status = z.infer<typeof statusSchema>;
