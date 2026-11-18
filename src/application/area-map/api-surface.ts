import type { AreaEndpointView } from '@/application/workspace-area';

type SurfaceEndpoint = Pick<AreaEndpointView, 'id' | 'signature' | 'protocol' | 'version'>;

export interface ApiSurface<Endpoint extends SurfaceEndpoint = AreaEndpointView> {
  readonly id: string;
  readonly label: string;
  readonly protocol: 'REST' | 'GraphQL' | 'gRPC' | 'HTTP' | 'API' | 'SDK';
  readonly versions: readonly string[];
  readonly endpoints: readonly Endpoint[];
}

function inferredRoute(signature: string) {
  const [method = '', route = ''] = signature.trim().split(/\s+/u);
  if (
    !/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?:\|[A-Z]+)*$/u.test(method) ||
    !route.startsWith('/')
  ) {
    const graph = /query|mutation|subscription|graphql/iu.test(signature);
    return {
      protocol: graph ? ('GraphQL' as const) : ('API' as const),
      label: graph ? 'GraphQL' : 'Other API',
      version: '',
    };
  }
  const parts = route.split('?')[0]?.split('/').filter(Boolean) ?? [];
  const version = parts.find((part) => /^v(?:\d[\w.-]*|\{[^}]+\})$/iu.test(part)) ?? '';
  const resource = parts.find(
    (part) => part !== version && part.toLowerCase() !== 'api' && !part.startsWith('{'),
  );
  return {
    protocol: 'REST' as const,
    label: resource === undefined ? '/' : `/${resource.split('[')[0] ?? resource}`,
    version,
  };
}

function routeOf(endpoint: SurfaceEndpoint) {
  if (endpoint.protocol === 'sdk') return { protocol: 'SDK' as const, label: 'SDK', version: '' };
  if (endpoint.protocol === 'graphql') {
    return { protocol: 'GraphQL' as const, label: 'GraphQL', version: '' };
  }
  if (endpoint.protocol === 'grpc') {
    return { protocol: 'gRPC' as const, label: 'gRPC', version: '' };
  }
  const route = inferredRoute(endpoint.signature);
  return endpoint.protocol === 'https' ? { ...route, protocol: 'HTTP' as const } : route;
}

/** Resource groups retain every operation identity; generic API/version prefixes are not resources. */
export function apiSurface<Endpoint extends SurfaceEndpoint>(
  endpoints: readonly Endpoint[],
): readonly ApiSurface<Endpoint>[] {
  const groups = new Map<string, ApiSurface<Endpoint>>();
  for (const endpoint of endpoints) {
    const route = routeOf(endpoint);
    const id = `surface:${route.protocol}:${route.label}`;
    const previous = groups.get(id);
    groups.set(id, {
      id,
      label: route.label,
      protocol: route.protocol,
      versions: [
        ...new Set([
          ...(previous?.versions ?? []),
          ...(route.version === '' ? [] : [route.version]),
          ...(endpoint.version === undefined ? [] : [endpoint.version]),
        ]),
      ].toSorted((a, b) => a.localeCompare(b)),
      endpoints: [...(previous?.endpoints ?? []), endpoint],
    });
  }
  return [...groups.values()];
}

export function surfaceLabel(surface: Pick<ApiSurface, 'label' | 'protocol' | 'versions'>): string {
  const versions = surface.versions.length === 0 ? '' : ` · ${surface.versions.join(', ')}`;
  const name =
    surface.protocol === surface.label
      ? `${surface.protocol} API`
      : `${surface.protocol} ${surface.label}`;
  return `${name}${versions}`;
}

export function endpointAnchor(component: string, endpoint: string): string {
  return `${component}:port:${endpoint}`;
}
