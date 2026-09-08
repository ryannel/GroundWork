"""Produce the reviewed Wordloop task breakdown from the unchanged import.

Writes a candidate delivery document to stdout; never edits a live repository.
The mapping retains source ownership and test references. Execution evidence is
not transferred to newly scoped tasks. Apply via write_plan with revision checks.
"""
import json
import pathlib
import re

base = pathlib.Path(__file__).resolve().parent.parent / 'docs/wordloop-meeting-recording'
source = json.loads((base / 'portable/features/meeting-recording/delivery.json').read_text())
rows = json.loads((base / 'task-breakdown.json').read_text())
tests = json.loads((base.parent.parent / 'content/features/meeting-recording/tests.json').read_text())['cases']
contracts = json.loads((base.parent.parent / 'content/features/meeting-recording/api.json').read_text())['contracts']
test_by_id = {t['id']: t for t in tests}
old_tasks = {t['id']: t for t in source['tasks']}
children = {old_id: [r['id'] for r in rows if r['sourceTaskId'] == old_id] for old_id in old_tasks}
plan = {**source, 'tasks': [], 'validation': [v for v in source['validation'] if v['level'] == 'end-to-end']}
assert not source['branches'] and not any(e.get('taskId') or e.get('validationId') for e in source['evidence']), 'Review existing associations before decomposition'

def owned(c, component):
    return component in (c['from'], c['to'])

def linked_contracts(scope, tids, component):
    explicit = {cid for tid in tids for cid in test_by_id[tid].get('contracts', [])}
    prose = ' '.join(scope)
    # Link only exact public-boundary names, never fuzzy endpoint matching.
    return [c['id'] for c in contracts if owned(c, component) and (c['id'] in explicit or re.search(r'(?<![\w/])' + re.escape(c['name']) + r'(?=$|[`\s.;,])', prose))]

for d in plan['deliverables']:
    d['title'] = re.sub(r'^\d+\s+', '', d['title'])
# Describe deliverable value, keeping stable IDs and acceptance unchanged.
plan['deliverables'][1]['title'] = 'Manage action items across meetings'
plan['deliverables'][2]['title'] = 'Keep notes linked to meetings and people'
for row in rows:
    old = old_tasks[row['sourceTaskId']]
    old_check = next((v for v in source['validation'] if v.get('taskId') == old['id']), None)
    scope = row.get('scope', [old['scope'][i] for i in row['scopeIndices']])
    prefix = 'm' + old['id'][:2] + '-' + old['id'].rsplit('-', 1)[1] + '-'
    tids = [prefix + str(i).zfill(2) for i in row['testNumbers']]
    assert all(tid in test_by_id for tid in tids), row['id']
    deps = row.get('dependsOn')
    if deps is None:
        deps = [child for dep in old['dependsOn'] for child in children.get(dep, [dep])]
    acceptance = row.get('acceptance', list(dict.fromkeys(a for tid in tids for a in test_by_id[tid]['then'])))
    # Empty acceptance remains a planning gap; an outline is not test coverage.
    task = {**old, 'id': row['id'], 'title': row['title'], 'summary': row['summary'], 'scope': scope,
            'dependsOn': deps, 'acceptance': acceptance,
            'contractIds': linked_contracts(scope, tids, old['componentId']),
            'prerequisites': row.get('prerequisites', [])}
    if old['componentId'] == 'c-wl-core':
        task['prerequisites'].append('Include only the schema changes required by this behavior; regenerate API clients after changing public contracts.')
    plan['tasks'].append(task)
    check = {k: v for k, v in (old_check or {}).items() if k not in ('id', 'taskId', 'testIds', 'title', 'notes')}
    check.update(id='check-' + task['id'], level='component-integration', taskId=task['id'],
                 title=task['title'] + ' · boundary check', testIds=tids,
                 realDependencyIds=[task['componentId']],
                 substitutedDependencyIds=(old_check or {}).get('substitutedDependencyIds', []))
    boundary = [c['name'] for c in contracts if c['id'] in task['contractIds']]
    check['entryPoint'] = '; '.join(boundary) if boundary else (old_check or {}).get('entryPoint', 'Define the public interaction or event boundary for this behavior')
    check['notes'] = ('Selected scenarios from the imported component suite. Run only the linked scenarios when validating this task; the suite command is broader. Some imported scenarios span multiple behaviors; refine those assertions to this task before execution. Test definitions are not passing evidence.' if tids else 'Validation still needs task-specific scenarios and acceptance assertions. No coverage or passing result is inferred from the source outline.')
    if old_check and any(test_by_id[tid].get('status') == 'deferred' or 'deferred' in test_by_id[tid]['title'].lower() for tid in tids):
        check['notes'] += ' The source includes deferred scenarios; resolve them before treating this task as ready.'
    plan['validation'].append(check)
# The source App suite included a complete user journey; keep that at E2E level.
plan['validation'][0]['testIds'].append('m01-app-46')
# Preserve every original scenario association somewhere in the new plan.
old_tids = {tid for v in source['validation'] for tid in v['testIds']}
new_tids = {tid for v in plan['validation'] for tid in v['testIds']}
assert old_tids <= new_tids, old_tids - new_tids
assert all(t['status'] == 'planned' for t in plan['tasks']), 'Review status before carrying it into new task scopes'
print(json.dumps(plan, indent=2))
