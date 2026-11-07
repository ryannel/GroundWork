import { lastIdPart } from '@/domain/ids';

const ENTITY: Record<string, string> = { '#': '#35;', ';': '#59;', '<': '#lt;', '>': '#gt;' };

/** Text for a Mermaid label: markdown and line breaks gone, `;` `#` `<` `>` as entity codes. */
export function mmText(text?: string): string {
  return (text ?? '')
    .replaceAll(/\[\[([^\]]{1,200})\]\]/gu, (_, id: string) => lastIdPart(id))
    .replaceAll(/\[([^\]]{1,200})\]\([^)]{0,200}\)/gu, '$1')
    .replaceAll(/`([^`]*)`/gu, '$1')
    .replaceAll(/(\*{1,3}|__)(?=\S)([^*_\n]*?\S)\1/gu, '$2')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .replaceAll(/[#;<>]/gu, (c) => ENTITY[c] ?? c);
}
