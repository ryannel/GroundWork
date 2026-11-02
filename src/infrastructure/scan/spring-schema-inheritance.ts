import 'server-only';

import type { JavaType, JavaUnit } from './java-declarations';
import { springInstantiate } from './spring-schema-generics';
import { springTypeReference } from './spring-schema-types';

export interface SpringDeclaration {
  readonly unit: JavaUnit;
  readonly type: JavaType;
}

export function springDeclaration(
  name: string,
  context: JavaUnit,
  declarations: readonly SpringDeclaration[],
): SpringDeclaration | undefined {
  const base = springTypeReference(name).name;
  const outer = base.split('.')[0] ?? base;
  const imported = context.imports.find((candidate) => candidate.endsWith(`.${outer}`));
  const qualified =
    imported === undefined
      ? `${context.packageName}.${base}`
      : `${imported}${base.slice(outer.length)}`;
  const sameUnit = declarations.filter(
    (candidate) => candidate.unit.path === context.path && candidate.type.name === base,
  );
  return (
    declarations.find((candidate) => candidate.type.qualifiedName === base) ??
    declarations.find((candidate) => candidate.type.qualifiedName === qualified) ??
    (sameUnit.length === 1 ? sameUnit[0] : undefined)
  );
}

/** The closure preserves a cycle as a reference and never unfolds it recursively. */
export function springInheritedDeclarations(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
): { readonly declarations: readonly SpringDeclaration[]; readonly unresolved: readonly string[] } {
  const found: SpringDeclaration[] = [];
  const unresolved: string[] = [];
  const pending = [declaration];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current.type.qualifiedName)) continue;
    visited.add(current.type.qualifiedName);
    found.push(current);
    for (const parent of [...current.type.extends, ...current.type.implements]) {
      const resolved = springDeclaration(parent, current.unit, declarations);
      if (resolved) pending.push({ ...resolved, type: springInstantiate(resolved.type, parent) });
      else unresolved.push(parent);
    }
  }
  return { declarations: found, unresolved: [...new Set(unresolved)] };
}

/** Group and view inheritance is source-declared assignability, separate from field presence. */
export function springProfileClosure(
  profiles: readonly string[],
  unit: JavaUnit,
  declarations: readonly SpringDeclaration[],
): readonly string[] {
  const closure = new Set(profiles);
  for (const profile of profiles) {
    const declaration = springDeclaration(profile, unit, declarations);
    if (!declaration) continue;
    for (const inherited of springInheritedDeclarations(declaration, declarations).declarations) {
      closure.add(inherited.type.qualifiedName);
      closure.add(inherited.type.name);
      closure.add(inherited.type.qualifiedName.slice(inherited.unit.packageName.length + 1));
      for (const name of parentProfileNames(inherited, declarations)) closure.add(name);
    }
  }
  return [...closure];
}

function profileIdentity(
  name: string,
  unit: JavaUnit,
  declarations: readonly SpringDeclaration[],
): string | undefined {
  const declared = springDeclaration(name, unit, declarations);
  if (declared) return declared.type.qualifiedName;
  const outer = name.split('.')[0] ?? name;
  const imported = unit.imports.find((candidate) => candidate.endsWith(`.${outer}`));
  if (imported !== undefined) return `${imported}${name.slice(outer.length)}`;
  return /^[a-z]/u.test(name) && name.includes('.') ? name : undefined;
}

function parentProfileNames(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
): readonly string[] {
  return declaration.type.extends.flatMap((parent) => {
    const identity = profileIdentity(parent, declaration.unit, declarations);
    return identity === undefined ? [parent] : [parent, identity];
  });
}

const DEFAULT_PROFILES = new Set([
  'jakarta.validation.groups.Default',
  'javax.validation.groups.Default',
]);

function unresolvedParents(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
): readonly string[] {
  return [...declaration.type.extends, ...declaration.type.implements].flatMap((parent) => {
    const identity = profileIdentity(parent, declaration.unit, declarations);
    if (identity !== undefined && DEFAULT_PROFILES.has(identity)) return [];
    return springDeclaration(parent, declaration.unit, declarations) ? [] : [identity ?? parent];
  });
}

function unresolvedProfile(
  profile: string,
  unit: JavaUnit,
  declarations: readonly SpringDeclaration[],
): readonly string[] {
  const identity = profileIdentity(profile, unit, declarations);
  if (identity !== undefined && DEFAULT_PROFILES.has(identity)) return [];
  const resolved = springDeclaration(profile, unit, declarations);
  if (!resolved) return [profile];
  return springInheritedDeclarations(resolved, declarations).declarations.flatMap((declaration) =>
    unresolvedParents(declaration, declarations),
  );
}

/** Missing source parents bound the profile closure rather than creating hypothetical package types. */
export function springProfileUnresolved(
  profiles: readonly string[],
  unit: JavaUnit,
  declarations: readonly SpringDeclaration[],
): readonly string[] {
  return [
    ...new Set(profiles.flatMap((profile) => unresolvedProfile(profile, unit, declarations))),
  ];
}
