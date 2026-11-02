import 'server-only';

import {
  type JavaMethod,
  type JavaType,
  type JavaUnit,
  resolveJavaType,
} from './java-declarations';

export function springRegistryParameter(
  method: JavaMethod,
  config: JavaType,
  units: readonly JavaUnit[],
): string | undefined {
  const unit = units.find((candidate) => candidate.types.includes(config));
  const parameter = method.parameters[0];
  if (!unit || !parameter || method.parameters.length !== 1) return undefined;
  return resolveJavaType(parameter.type, unit) ===
    'org.springframework.web.servlet.config.annotation.InterceptorRegistry'
    ? parameter.name
    : undefined;
}

function objectType(name: string, unit: JavaUnit, units: readonly JavaUnit[]): string {
  if (name !== 'Object') return resolveJavaType(name, unit);
  const shadowed = units.some(
    (entry) =>
      entry.packageName === unit.packageName && entry.types.some((type) => type.name === 'Object'),
  );
  if (shadowed || unit.imports.some((entry) => entry.endsWith('.Object'))) {
    return resolveJavaType(name, unit);
  }
  return 'java.lang.Object';
}

function preHandleSignature(
  method: JavaMethod,
  unit: JavaUnit,
  units: readonly JavaUnit[],
): boolean {
  if (
    method.name !== 'preHandle' ||
    method.returnType !== 'boolean' ||
    method.parameters.length !== 3
  ) {
    return false;
  }
  const [request, response, handler] = method.parameters;
  if (!request || !response || !handler) return false;
  const requestType = resolveJavaType(request.type, unit);
  const responseType = resolveJavaType(response.type, unit);
  const servletPair = ['jakarta', 'javax'].some(
    (prefix) =>
      requestType === `${prefix}.servlet.http.HttpServletRequest` &&
      responseType === `${prefix}.servlet.http.HttpServletResponse`,
  );
  return servletPair && objectType(handler.type, unit, units) === 'java.lang.Object';
}

export function springPreHandle(
  interceptor: JavaType | undefined,
  units: readonly JavaUnit[],
): JavaMethod | undefined {
  if (!interceptor) return undefined;
  const unit = units.find((candidate) => candidate.types.includes(interceptor));
  if (
    !unit ||
    !interceptor.implements.some(
      (name) =>
        resolveJavaType(name, unit) === 'org.springframework.web.servlet.HandlerInterceptor',
    )
  ) {
    return undefined;
  }
  return interceptor.methods.find((method) => preHandleSignature(method, unit, units));
}
