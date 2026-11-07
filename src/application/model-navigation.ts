import { entryFlowHref } from '@/application/entry-flow-paths';
import type { ModelIndex } from '@/application/model-index';
import { modelReferenceOf } from '@/application/model-reference';
import { keyOf } from '@/application/plan-pages-key';
import {
  journeyHref,
  journeysHref,
  referenceHref,
  referenceKindHref,
} from '@/application/today-reader';
import type { NavGroup, NavHere } from '@/application/workspace-nav';
import {
  languageHref,
  partnersHref,
  peopleHref,
  plansHref,
  programmesHref,
  valueFlowsHref,
  workspaceHref,
} from '@/application/workspace-paths';
import { stripPrefix } from '@/domain/ids';

export type ModelNavHere = Omit<NavHere, 'today' | 'section'> & {
  readonly section?: NavHere['section'] | 'entries';
};

function overview(index: ModelIndex, here: ModelNavHere): NavGroup {
  const id = index.model.id;
  const map = here.domain === undefined && here.section === undefined;
  const area = here.section === 'area';
  const words = here.section === 'language';
  const people = here.section === 'people';
  const flows = here.section === 'value-flows';
  return {
    key: 'landscape',
    heading: 'Overview',
    title: 'Landscape',
    href: workspaceHref(id),
    current: map || area || flows,
    open: [map, area, words, people, flows].some(Boolean),
    items: [
      { href: workspaceHref(id), title: 'Map', current: map },
      { href: valueFlowsHref(id), title: 'Value Flows', current: flows },
      { href: languageHref(id), title: 'Language', current: words },
      { href: peopleHref(id), title: 'People', current: people },
    ],
  };
}
function group(key: string, title: string, href: string, here: ModelNavHere, count = 0): NavGroup {
  return {
    key,
    title,
    href,
    ...(count === 0 ? {} : { count: String(count) }),
    current: here.section === key,
    open: false,
    items: [],
  };
}
function journeys(index: ModelIndex, here: ModelNavHere): NavGroup {
  const current = here.section === 'journeys';
  const records = [...index.model.journeys, ...index.model.flows];
  const selected = records.find((record) => current && keyOf(record.id) === here.key);
  return {
    ...group('journeys', 'Journeys', journeysHref(index.model.id), here, records.length),
    heading: 'Look up',
    open: current,
    items:
      selected === undefined
        ? []
        : [
            {
              href: journeyHref(index.model.id, keyOf(selected.id)),
              title: selected.name,
              current: true,
            },
          ],
  };
}
function reference(index: ModelIndex, here: ModelNavHere): NavGroup {
  const current = here.section === 'reference';
  return {
    ...group('reference', 'Reference', referenceHref(index.model.id), here),
    open: current,
    items: modelReferenceOf(index).map((entry) => ({
      href: referenceKindHref(index.model.id, entry.kind),
      title: entry.title,
      count: String(entry.count),
      current: current && here.key === entry.kind,
    })),
  };
}
/** The native workspace rail uses canonical identity and counts, without projecting a legacy model. */
export function modelWorkspaceNavOf(
  index: ModelIndex,
  plans: readonly unknown[],
  here: ModelNavHere = {},
): readonly NavGroup[] {
  const model = index.model;
  const partners = (model.teams ?? []).filter((team) => team.partner === true);
  return [
    overview(index, here),
    group('plans', 'Plans', plansHref(model.id), here, plans.length),
    ...(model.programmes.length === 0
      ? []
      : [
          group(
            'programmes',
            'Programmes',
            programmesHref(model.id),
            here,
            model.programmes.length,
          ),
        ]),
    ...(partners.length === 0
      ? []
      : [group('partners', 'Partners', partnersHref(model.id), here, partners.length)]),
    ...model.domains.map((domain, at): NavGroup => ({
      key: domain.id,
      ...(at === 0 ? { heading: 'Domains' } : {}),
      title: domain.name,
      href: index.href(domain.id),
      count: String(domain.systems.length),
      current: here.domain === domain.id || here.domain === stripPrefix(domain.id, 'dom'),
      open: false,
      items: [],
    })),
    journeys(index, here),
    group('entries', 'Entry flows', entryFlowHref(model.id), here, index.entries().length),
    group('explorer', 'Services', `${workspaceHref(model.id)}explorer/`, here),
    reference(index, here),
  ];
}
