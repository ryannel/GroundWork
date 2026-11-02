import 'server-only';

import { z } from 'zod';

export const SCAN_PHYSICAL_LIMIT = 64 * 1024 * 1024;
export const SCAN_PAGE_LIMIT = 16 * 1024 * 1024;
export const SCAN_FRAGMENT_LIMIT = 11 * 1024 * 1024;
export const SCAN_PAGE_COUNT = 64;
export const SCAN_SOURCE_LIMIT = 256 * 1024 * 1024;
const SCAN_PROGRAM_LIMIT = 512 * 1024 * 1024;
export interface FramedScanOptions {
  readonly kind?: 'source' | 'program';
  readonly forceFraming?: boolean;
}
const hash = z.string().regex(/^[a-f\d]{64}$/u);
const page = z
  .object({
    path: z.string(),
    sha256: hash,
    bytes: z.number().int().positive().max(SCAN_PAGE_LIMIT),
    decodedBytes: z.number().int().positive().max(SCAN_FRAGMENT_LIMIT),
  })
  .strict();
const entry = z.discriminatedUnion('kind', [
  z.object({ key: z.string(), kind: z.literal('value'), json: z.string() }).strict(),
  z
    .object({
      key: z.string(),
      kind: z.literal('collection'),
      records: z.number().int().nonnegative(),
      pages: z.array(page).max(SCAN_PAGE_COUNT),
    })
    .strict(),
]);
export const framedScanManifest = z
  .object({
    format: z.literal('scan-framed/v1'),
    logicalBytes: z.number().int().positive().max(SCAN_PROGRAM_LIMIT),
    logicalSha256: hash,
    entries: z.array(entry).min(1).max(128),
  })
  .strict();
export const framedScanPage = z
  .object({ format: z.literal('scan-record-page/v1'), base64: z.string() })
  .strict();
export type FramedEntry = z.infer<typeof entry>;
export type FramedManifest = z.infer<typeof framedScanManifest>;
export type FramedPageReference = z.infer<typeof page>;

export function framedLogicalLimit(options: FramedScanOptions): number {
  return options.kind === 'program' ? SCAN_PROGRAM_LIMIT : SCAN_SOURCE_LIMIT;
}
export function framedObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function framedJson(value: unknown): string {
  return JSON.stringify(value);
}
