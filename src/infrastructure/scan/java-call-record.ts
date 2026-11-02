import 'server-only';

import type { JavaBindingContext, JavaCallSite } from './java-call-binding-types';
import { javaTypeName } from './java-call-types';
import type { JavaField } from './java-declarations';

/** A record component specifies accessor shape, without inventing an executable source method. */
export function javaRecordAccessor(
  context: JavaBindingContext,
  site: JavaCallSite,
): { readonly field: JavaField; readonly returnType: string } | null {
  if (site.arguments.length > 0) return null;
  const unit = context.units.find((entry) =>
    entry.types.some((type) => type.qualifiedName === site.receiverType && type.kind === 'record'),
  );
  const owner = unit?.types.find((type) => type.qualifiedName === site.receiverType);
  if (
    !unit ||
    !owner ||
    owner.methods.some(
      (method) => method.name === site.methodName && method.parameters.length === 0,
    )
  ) {
    return null;
  }
  const field = owner.fields.find(
    (entry) => entry.name === site.methodName && !entry.modifiers.includes('static'),
  );
  return field ? { field, returnType: javaTypeName(field.type, unit) } : null;
}
