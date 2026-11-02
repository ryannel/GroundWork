import 'server-only';

import type { JavaAnnotation, JavaMethod, JavaType, JavaUnit } from './java-declarations';

export interface SpringMethod {
  readonly unit: JavaUnit;
  readonly controller: JavaType;
  readonly declaration: JavaMethod;
  readonly implementation: JavaMethod | undefined;
  readonly inherited: readonly JavaType[];
}

const WEB = 'org.springframework.web.bind.annotation.';
const FRAMEWORK_ANNOTATIONS: Readonly<Record<string, readonly string[]>> = {
  RestController: [`${WEB}RestController`],
  Controller: ['org.springframework.stereotype.Controller'],
  RequestMapping: [`${WEB}RequestMapping`],
  GetMapping: [`${WEB}GetMapping`],
  PostMapping: [`${WEB}PostMapping`],
  PutMapping: [`${WEB}PutMapping`],
  PatchMapping: [`${WEB}PatchMapping`],
  DeleteMapping: [`${WEB}DeleteMapping`],
  RequestHeader: [`${WEB}RequestHeader`],
  RequestParam: [`${WEB}RequestParam`],
  PathVariable: [`${WEB}PathVariable`],
  RequestBody: [`${WEB}RequestBody`],
  ResponseStatus: [`${WEB}ResponseStatus`],
  Validated: ['org.springframework.validation.annotation.Validated'],
  Valid: ['jakarta.validation.Valid', 'javax.validation.Valid'],
  Configuration: ['org.springframework.context.annotation.Configuration'],
  PreAuthorize: ['org.springframework.security.access.prepost.PreAuthorize'],
  Secured: ['org.springframework.security.access.annotation.Secured'],
  RolesAllowed: [
    'jakarta.annotation.security.RolesAllowed',
    'javax.annotation.security.RolesAllowed',
  ],
};

export function springMappingAnnotation(
  annotations: readonly JavaAnnotation[],
): JavaAnnotation | undefined {
  return [
    'RequestMapping',
    'GetMapping',
    'PostMapping',
    'PutMapping',
    'PatchMapping',
    'DeleteMapping',
  ]
    .map((name) => springAnnotation(annotations, name))
    .find((annotation) => annotation !== undefined);
}

export function springAnnotation(
  annotations: readonly JavaAnnotation[],
  name: string,
): JavaAnnotation | undefined {
  const names = FRAMEWORK_ANNOTATIONS[name] ?? [];
  return annotations.find((annotation) => names.includes(annotation.name));
}

function qualified(name: string, unit: JavaUnit): string {
  if (
    name.includes('.') ||
    /^(?:void|boolean|byte|char|short|int|long|float|double|extends|super)$/u.test(name)
  ) {
    return name;
  }
  if (
    /^(?:String|Object|Boolean|Byte|Character|Short|Integer|Long|Float|Double|Number|Void)$/u.test(
      name,
    )
  ) {
    return `java.lang.${name}`;
  }
  return unit.imports.find((entry) => entry.endsWith(`.${name}`)) ?? `${unit.packageName}.${name}`;
}

function springSignature(method: JavaMethod, unit: JavaUnit): string {
  return `${method.name}(${method.parameters.map((parameter) => parameter.type.replaceAll(/\s/gu, '').replaceAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/gu, (name) => qualified(name, unit))).join(',')})`;
}

function ancestors(controller: JavaType, units: readonly JavaUnit[]): readonly JavaType[] {
  const found = new Set<JavaType>();
  const pending = [controller];
  while (pending.length > 0) {
    const parent = pending.shift() ?? controller;
    const unit = units.find((entry) => entry.types.includes(parent));
    if (!unit) continue;
    for (const name of [...parent.implements, ...parent.extends]) {
      const type = units
        .flatMap((entry) => entry.types)
        .find((entry) => entry.qualifiedName === qualified(name, unit));
      if (!type || found.has(type)) continue;
      found.add(type);
      pending.push(type);
    }
  }
  return [...found];
}

export function springMethods(units: readonly JavaUnit[]): readonly SpringMethod[] {
  return units.flatMap((unit) =>
    unit.types
      .filter(
        (type) =>
          springAnnotation(type.annotations, 'RestController') ??
          springAnnotation(type.annotations, 'Controller'),
      )
      .flatMap((controller) => controllerMethods({ unit, controller, units })),
  );
}

function controllerMethods(input: {
  readonly unit: JavaUnit;
  readonly controller: JavaType;
  readonly units: readonly JavaUnit[];
}): readonly SpringMethod[] {
  const { unit, controller, units } = input;
  const inherited = ancestors(controller, units);
  const declarations = [...controller.methods, ...inherited.flatMap((type) => type.methods)];
  const seen = new Set<string>();
  return declarations.flatMap((declaration) => {
    const owner =
      units.find((entry) => entry.types.some((type) => type.methods.includes(declaration))) ?? unit;
    const signature = springSignature(declaration, owner);
    if (seen.has(signature) || !springMappingAnnotation(declaration.annotations)) {
      return [];
    }
    seen.add(signature);
    const implementation = controller.methods.find(
      (method) => springSignature(method, unit) === signature,
    );
    return [{ unit, controller, declaration, implementation, inherited }];
  });
}

function authorisation(annotations: readonly JavaAnnotation[]): JavaAnnotation | undefined {
  return (
    springAnnotation(annotations, 'PreAuthorize') ??
    springAnnotation(annotations, 'Secured') ??
    springAnnotation(annotations, 'RolesAllowed')
  );
}

export function springMethodAuthorisation(method: SpringMethod): JavaAnnotation | undefined {
  return (
    authorisation(method.implementation?.annotations ?? []) ??
    authorisation(method.declaration.annotations) ??
    authorisation(method.controller.annotations) ??
    method.inherited
      .map((type) => authorisation(type.annotations))
      .find((policy) => policy !== undefined)
  );
}
