import { createReport, type Issue, type Report } from '@/application/plan/check-context';
import { qualifiedProblem } from '@/application/plan/check-neighbours';
import { citationsIn, qualifiedOf, typeOf, walkStrings } from '@/application/plan/ids';
import { programmeDeciderProblems } from '@/application/programme-deciders';
import type { PathSegment } from '@/domain/plan/plan-ids';
import type { Neighbours } from '@/domain/plan/plan-neighbours';
import type { Programme } from '@/domain/plan/plan.generated';

// programmes/<id>/programme.yaml: the outcome some plans serve, and the scenarios, decisions, questions and
// milestones they share. Plans cite them as `<programme>/<id>`; the programme names no plan.

export interface ProgrammeAt {
  /** The folder the programme is in, which its id must match. */
  readonly folder: string;
  /** The workspace's teams. */
  readonly teams: ReadonlySet<string>;
  readonly neighbours: Neighbours | null;
}

interface Entry {
  readonly id: string;
  readonly path: readonly PathSegment[];
}

function entriesOf(programme: Programme): Entry[] {
  const each = (key: string, list: readonly { readonly id: string }[] | undefined): Entry[] =>
    (list ?? []).map((item, i) => ({ id: item.id, path: [key, i] }));
  return [
    ...each('scenarios', programme.scenarios),
    ...(programme.problem?.scenarios ?? []).map((item, i) => ({
      id: item.id,
      path: ['problem', 'scenarios', i],
    })),
    ...each('decisions', programme.decisions),
    ...each('questions', programme.questions),
    ...each('milestones', programme.milestones),
  ];
}

/** References inside the programme: [where, the id, the types it may be]. */
function refsOf(programme: Programme): [readonly PathSegment[], string, readonly string[]][] {
  return [
    ...(programme.decisions ?? []).flatMap((d, i) =>
      (d.supersedes ?? []).map((id, j): [readonly PathSegment[], string, readonly string[]] => [
        ['decisions', i, 'supersedes', j],
        id,
        ['decision'],
      ]),
    ),
    ...(programme.questions ?? []).flatMap(
      (q, i): [readonly PathSegment[], string, readonly string[]][] =>
        q.answered_by === undefined
          ? []
          : [[['questions', i, 'answered_by'], q.answered_by, ['decision']]],
    ),
    ...(programme.milestones ?? []).flatMap((m, i) =>
      (m.after ?? []).map((id, j): [readonly PathSegment[], string, readonly string[]] => [
        ['milestones', i, 'after', j],
        id,
        ['milestone'],
      ]),
    ),
  ];
}

function definedOnce(programme: Programme, rep: Report): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entry of entriesOf(programme)) {
    if (ids.has(entry.id)) {
      rep.error([...entry.path, 'id'], `${entry.id} is defined twice; rename one`);
    }
    ids.add(entry.id);
  }
  return ids;
}

function checkNamed(
  programme: Programme,
  at: ProgrammeAt,
  ids: ReadonlySet<string>,
  rep: Report,
): void {
  for (const [path, id, types] of refsOf(programme)) {
    const type = typeOf(id);
    if (type === null || !types.includes(type) || !ids.has(id)) {
      rep.error(path, `${id} is no ${types.join(' or ')} in this programme; fix the id`);
    }
  }
  for (const { path, message } of programmeDeciderProblems(programme, (id) => at.teams.has(id))) {
    rep.error(path, message);
  }
  for (const [i, milestone] of (programme.milestones ?? []).entries()) {
    if (milestone.serves === undefined) continue;
    rep.error(
      ['milestones', i, 'serves'],
      'a programme milestone is what plan milestones serve; it serves none',
    );
  }
}

function citationProblem(id: string, at: ProgrammeAt, ids: ReadonlySet<string>): string | null {
  if (qualifiedOf(id) !== null) return qualifiedProblem(at.neighbours, id, null);
  return ids.has(id) ? null : `${id} is not in this programme`;
}

/** What is wrong with a programme: its id, ids it defines twice, and what it names that is not there. */
export function checkProgramme(programme: Programme, at: ProgrammeAt): Issue[] {
  const rep = createReport(false);
  if (programme.id !== at.folder) {
    rep.error(
      ['id'],
      `the id is ${programme.id}, but the folder is ${at.folder}; make them the same`,
    );
  }
  const ids = definedOnce(programme, rep);
  checkNamed(programme, at, ids, rep);
  walkStrings(programme, (text, segs) => {
    for (const id of citationsIn(text)) {
      const problem = citationProblem(id, at, ids);
      if (problem !== null) rep.error(segs, `cites [[${id}]]: ${problem}`);
    }
  });
  return [...rep.errors];
}
