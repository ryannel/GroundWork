import type {
  AreaComponentView,
  AreaResourceView,
  AreaSystemView,
} from '@/application/workspace-area';
import { plural } from '@/shared/text';

function technologyName(value: string | null | undefined): string {
  if (value === undefined || value === null) return 'Technology not recorded';
  const names: Readonly<Record<string, string>> = {
    postgresql: 'PostgreSQL',
    postgres: 'PostgreSQL',
    redis: 'Redis',
    kafka: 'Kafka',
    mongodb: 'MongoDB',
    mysql: 'MySQL',
    dynamodb: 'DynamoDB',
    rabbitmq: 'RabbitMQ',
    elasticsearch: 'Elasticsearch',
    opensearch: 'OpenSearch',
    'sql server': 'SQL Server',
  };
  const matches =
    value.match(
      /PostgreSQL|Postgres|Redis|Kafka|MongoDB|MySQL|DynamoDB|RabbitMQ|Elasticsearch|OpenSearch|SQL Server/giu,
    ) ?? [];
  const technologies = [...new Set(matches.map((name) => names[name.toLowerCase()] ?? name))];
  return technologies.length === 0 ? (value.split(' (')[0] ?? value) : technologies.join(', ');
}

export function componentKind(component: AreaComponentView): string {
  const native = {
    service: 'Service',
    app: 'App',
    store: 'Store',
    topic: 'Topic',
    library: 'Library',
    external: 'External',
  };
  if (component.modelKind !== undefined) return native[component.modelKind];
  const names = {
    service: 'Service',
    website: 'App',
    database: 'Store',
    queue: 'Topic',
    job: 'Job',
    library: 'Library',
    external: 'External',
  };
  if (component.category === 'cache') return 'Cache';
  if (component.category === 'queue') return 'Queue';
  return names[component.kind];
}

export function linkedResources(component: AreaComponentView): readonly AreaResourceView[] {
  const embedded = new Set((component.attachments ?? []).map((resource) => resource.id));
  return [
    ...new Map(component.resources.map((resource) => [resource.id, resource])).values(),
  ].filter((resource) => !embedded.has(resource.id));
}

interface ResourceLocation {
  readonly system: AreaSystemView;
  readonly component: AreaComponentView;
  readonly resource: AreaComponentView;
}

export function resourceLocation(
  systems: readonly AreaSystemView[],
  id: string,
): ResourceLocation | null {
  for (const system of systems) {
    const resource = system.components
      .flatMap((component) => [component, ...(component.attachments ?? [])])
      .find((component) => component.id === id);
    if (resource === undefined) continue;
    const component =
      system.components.find(
        (item) =>
          item.id === resource.parentComponent ||
          item.attachments?.some((attachment) => attachment.id === id) === true,
      ) ?? resource;
    return { system, component, resource };
  }
  return null;
}

export function resourceCaption(resource: AreaResourceView): string {
  return `${technologyName(resource.technology)} ${resource.category ?? resource.kind}`;
}

export function resourceSummary(component: AreaComponentView): string {
  if (component.kind === 'database' || component.kind === 'queue') {
    return technologyName(component.technology);
  }
  const resources = [
    ...new Map(component.resources.map((resource) => [resource.id, resource])).values(),
  ];
  if (resources.length === 0) return component.technology ?? 'No resources recorded';
  const counts = new Map<string, number>();
  for (const resource of resources) {
    const technology = technologyName(resource.technology);
    const label = `${technology} ${resource.category ?? resource.kind}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => plural(count, label)).join(' · ');
}
