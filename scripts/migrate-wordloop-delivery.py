"""Enrich the frozen import with deliverable outcomes, component tasks and test provenance.
Only plan definitions are migrated; no execution success is inferred.
"""
import json
import pathlib
import re

base = pathlib.Path(__file__).resolve().parent.parent / 'docs/wordloop-meeting-recording'
file = base / 'portable/features/meeting-recording/delivery.json'
plan = json.loads(file.read_text())
manifest = json.loads((base / 'source-manifest.json').read_text())
api = json.loads((base.parent.parent / 'content/features/meeting-recording/api.json').read_text())['contracts']
cases = json.loads((base.parent.parent / 'content/features/meeting-recording/tests.json').read_text())['cases']
case_by_id = {case['id']: case for case in cases}
source_tests = manifest['testSources']
old_tasks = plan['tasks']
plan['tasks'] = []
plan['validation'] = []

for milestone in plan['deliverables']:
    mid = milestone['id']
    source = (base / 'sources/tdd/milestones' / mid / 'index.mdx').read_text()
    milestone['outcome'] = re.search(r'## Goal\s+([\s\S]+?)(?=\n## |\Z)', source).group(1).strip()
    domains = [s['id'].rsplit('-', 1)[1] for s in old_tasks if s['deliverableId'] == mid]
    milestone['componentIds'] = ['c-wl-app', 'c-wl-core'] + (['c-wl-ml'] if 'ml' in domains else [])
    test_ids = [tid for tid, info in source_tests.items() if info['source'] == f'tdd/milestones/{mid}/index.mdx']
    testfile = re.search(r'`(tests/[^`]+\.py)`', source)
    plan['validation'].append({
        'id': f'e2e-{mid}', 'level': 'end-to-end', 'deliverableId': mid,
        'title': 'Prove the user-visible outcome', 'testIds': test_ids,
        **({'file': testfile.group(1)} if testfile else {}),
        'command': './dev test bet meeting-recording',
        'entryPoint': 'User journey through App, connected services, and persisted results',
        'environment': 'Full local Word Loop stack; verify provider configuration before running',
        'realDependencyIds': milestone['componentIds'], 'substitutedDependencyIds': [],
        'notes': 'Imported deliverable acceptance plan. Source checkboxes and the presence of a test file do not establish a passing end-to-end run or its dependency configuration.'
    })

for old in old_tasks:
    item = dict(old)
    mid = item['deliverableId']
    domain = item['id'].rsplit('-', 1)[1]
    component = f'c-wl-{domain}'
    folder = base / 'sources/tdd/milestones' / mid
    matches = list(folder.glob(f'slice-{domain}-*.mdx'))
    source = matches[0].read_text() if matches else ''
    scope = re.findall(r'^- \[[ xX]\] (.+)$', re.split(r'\n## (?:Dependencies|Test Cases|Completion Checklist)', source)[0], re.M)
    item['componentId'] = component
    item['scope'] = scope or [item['title'].split(': ', 1)[-1]]
    # Keep the original prerequisite text; it is not an acceptance assertion.
    milestone_source = (folder / 'index.mdx').read_text()
    row = next((r for r in milestone_source.splitlines() if re.match(r'^\| \d+ \| ' + domain + r' \|', r, re.I)), '')
    prerequisite = [row.split('|')[-2].strip()] if row else old.get('prerequisites', [])
    item['prerequisites'] = prerequisite
    source_path = f'tdd/milestones/{mid}/{matches[0].name}' if matches else ''
    tids = [tid for tid, info in source_tests.items() if info['source'] == source_path]
    item['acceptance'] = [assertion for tid in tids for assertion in case_by_id[tid]['then']]
    contract_ids = list(dict.fromkeys(cid for tid in tids for cid in case_by_id[tid].get('contracts', [])))
    # Preserve only explicitly mapped tests' contracts; absent mappings remain visible gaps.
    item['contractIds'] = [cid for cid in contract_ids if any(c['id'] == cid and component in [c['from'], c['to']] for c in api)]
    plan['tasks'].append(item)
    if source:
        testfile = re.search(r'`(tests/[^`]+\.py)`', source)
        plan['validation'].append({
            'id': f'integration-{item["id"]}', 'level': 'component-integration', 'taskId': item['id'],
            'title': f'{domain.upper() if domain == "ml" else domain.title()} boundary integration',
            'testIds': tids, **({'file': testfile.group(1)} if testfile else {}),
            'command': './dev test bet meeting-recording',
            'entryPoint': 'Public UI interactions and observable API requests' if domain == 'app' else ('HTTP and Pub/Sub entry points' if domain == 'ml' else 'HTTP/WebSocket API boundary'),
            'environment': 'Planned service-perimeter suite with real service internals and containerised infrastructure / emulators',
            'realDependencyIds': [component],
            'substitutedDependencyIds': ['c-wl-aai', 'c-wl-openai'] if domain == 'ml' else [],
            'notes': 'Source task test definitions; review against the honeycomb testing policy before execution. Provider substitutions are planned at the external boundary only. ' + ' '.join(prerequisite)
        })
for unit in plan['deliverables'] + plan['tasks']:
    for field in ['title', 'outcome', 'scope', 'acceptance', 'prerequisites']:
        if field in unit:
            def prose(value):
                return re.sub(r'\b(milestone|Milestone|slice|Slice)(s?)\b', lambda m: {'milestone': 'deliverable', 'Milestone': 'Deliverable', 'slice': 'task', 'Slice': 'Task'}[m[1]] + m[2], value)
            unit[field] = [prose(v) for v in unit[field]] if isinstance(unit[field], list) else prose(unit[field])
file.write_text(json.dumps(plan, indent=2) + '\n')
print(f'{len(plan["deliverables"])} deliverables, {len(plan["tasks"])} tasks, {len(plan["validation"])} validation plans; no passing runs inferred')
