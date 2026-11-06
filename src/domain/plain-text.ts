import { isAuthoredReference } from '@/domain/ids';
import { clip as clipText, plain as plainText, plainTitle as titleText } from '@/shared/plain-text';

// Model prose uses the authored-reference grammar owned by the identity module.
type Label = (id: string) => string;
export function plain(text: string | null | undefined, label: Label): string {
  return plainText(text, label, isAuthoredReference);
}
export function plainTitle(text: string | null | undefined, label: Label): string {
  return titleText(text, label, isAuthoredReference);
}
export function clip(text: string | null | undefined, label: Label, n = 140): string {
  return clipText(text, label, isAuthoredReference, n);
}
