"""Reconcile the frozen and captured Range map against checksummed model facts."""
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import sys

base, release, output = map(Path, sys.argv[1:])
receipts = Path('artifacts/rebuild/pr8/area-and-facts')
route = '/volvo-cars/areas/range/map.json'
route_file = f'route-{hashlib.sha256((json.dumps(route) + chr(10)).encode()).hexdigest()[:20]}.json.gz'

def read(path, expected=None):
    data = path.read_bytes()
    body = gzip.decompress(data) if path.suffix == '.gz' else data
    if expected is not None:
        assert hashlib.sha256(body).hexdigest() == expected, path
    return json.loads(body)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def serial(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)

before, after = (read(folder / route_file) for folder in (base, release))
assert before['route'] == after['route'] == route
assert before['status'] == after['status'] == 200
assert before['type'] == after['type'] == 'application/json'
old, new = before['payload'], after['payload']
frozen = read(base / 'facts.json.gz')
current = read(release / 'facts.json.gz')['current']
area_shard = next(row['view'] for row in current['areas'] if row['id'] == 'area:range')
def shard(row):
    return read(release / row['file'], row['sha256'])
assert shard(area_shard) == new
model, derived = (shard(current[k]) for k in ('model', 'derived'))
identities = {row['id']: row for row in derived['identities']}

def canonical(id):
    seen = set()
    while id in model['aliases']:
        assert id not in seen, id
        seen.add(id)
        id = model['aliases'][id]['to']
    return id

assert {**old['area'], 'id': canonical(old['area']['id'])} == new['area']
assert old['area']['evidenceCount'] == new['area']['evidenceCount'] == 36
for field in ('workspace', 'reviewed', 'scope', 'limitation'):
    assert old[field] == new[field], field
assert [{**edge, **{key: canonical(edge[key]) for key in ('from', 'to')}}
        for edge in old['relationships']] == new['relationships']
assert [{**group, 'systems': list(map(canonical, group['systems']))}
        for group in old['collaborations']] == new['collaborations']

old_flow, new_flow = (data['valueFlow'] for data in (old, new))
old_detail = next(row for row in frozen['landscape']['details'] if row['area'] == 'range')
new_detail = next(row for row in model['landscape']['details'] if row['area'] == 'area:range')
assert old_detail['valueFlow'] == old_flow
assert old_flow.keys() == new_flow.keys()
flow_checks = {}
for field, value in old_flow.items():
    if field == 'bands':
        expected = [{**band, 'nodes': [{**node, 'component': canonical(node['component'])}
                     for node in band['nodes']]} for band in value]
    elif field == 'columns':
        expected = [{**column, 'system': canonical(column['system'])} for column in value]
    elif field in ('connections', 'overview', 'summaries'):
        declared = new_detail['valueFlow'][field]
        assert len(value) == len(declared) == len(new_flow[field])
        expected = [{**a, 'from': canonical(a['from']), 'to': canonical(a['to']),
                     'evidence': list(map(canonical, a['evidence'])),
                     'backs': b['backs'], 'cites': b['cites']} for a,b in zip(value,declared)]
        assert all(row['evidence'] == row['backs'] for row in expected)
        flow_checks[field] = {'rows': len(value),
                              'backings': sum(len(row['backs']) for row in expected),
                              'cites': sum(len(row['cites']) for row in expected)}
    else:
        expected = value
    assert expected == new_flow[field], field

systems = {row['id']: row for row in new['systems']}
boundaries = {row['id']: row for row in new['boundaries']}
assert all(systems[id]['components'] == [] and systems[id]['resources'] == []
           for id in boundaries)
assert set(systems) == set(new_detail['systems']) | set(boundaries)
cards = {row['id']: row for system in systems.values() for row in system['components']}
assert set(cards).isdisjoint(boundaries)
old_cards = [row for system in old['systems'] for row in system['components']]
component_proof = {}
for card in old_cards:
    id = canonical(card['id'])
    assert id in identities and identities[id]['label'] == card['name'], card['id']
    if id in cards:
        disposition = 'declared-component'
    elif id in boundaries:
        disposition = 'unmapped-system-boundary'
    else:
        identity = identities[id]
        assert (identity['kind'] == 'external' or
                identity['kind'] == 'topic' and identity['place']['system'] == 'sys:offers'), id
        disposition = 'workspace-external' if identity['kind'] == 'external' else 'topic-in-offers'
    component_proof[card['id']] = {'id': id, 'disposition': disposition}

old_edges, new_edges = (data['technicalRelationships'] for data in (old, new))
area_ids = set(cards) | set(boundaries)
expected_edges = Counter(serial(edge) for edge in derived['componentEdges']
                         if edge['from'] in area_ids and edge['to'] in area_ids
                         and edge['kind'] != 'causes')
assert Counter(serial(row['native']) for row in new_edges) == expected_edges
assert len(set(row['id'] for row in new_edges)) == len(new_edges)
lookup = defaultdict(list)
for row in new_edges:
    assert row['evidenceIds'] == [row['native']['site']]
    assert row['evidenced'] == bool(row['native']['cites'])
    lookup[row['kind'], row['from'], row['to'],
           None if row['kind'] == 'data' else row['via']].append(row)
messages = {row['id']: row for row in frozen['plan']['messages']}
edge_reviews_file = receipts / 'derived-edge-exceptions.json'
edge_reviews = {row['id']: row for row in next(x for x in read(edge_reviews_file)['reports']
                if x['workspace'] == 'volvo-cars')['nonIdentical']}
modes = {'Reads': {'read'}, 'Writes': {'write'}, 'Reads and writes': {'read', 'write'},
         'Data access': set()}
edge_proof = []
for position, row in enumerate(old_edges):
    k, f, t, v = (row[name] for name in ('kind', 'from', 'to', 'via'))
    f2, t2, v2 = map(canonical, (f,t,v))
    matched = lookup[k, f2, t2, None if k == 'data' else v2]
    disposition = 'canonical-occurrences'
    if not matched and k == 'message':
        topic = canonical(messages[v]['topic'])
        publish = lookup[k, f2, topic, v2]
        consume = lookup[k, topic, t2, v2]
        if publish and consume:
            matched = publish + consume
            disposition = 'publication-and-subscription'
    row_proof = {'position': position, 'from': f, 'to': t, 'via': v}
    edge_key = f'{k}|{f}|{t}' + (f'|{v}' if k == 'api' else '')
    review = edge_reviews.get(edge_key)
    if not matched:
        if review is not None:
            assert review['cause'] == 'authored-flow-only' and row['evidence'] == 'flow'
            assert all(s['retained'] and s['native'] in identities for s in review['sourceSites'])
            disposition = 'retained-authored-flow'
            row_proof['sourceSites'] = [s['native'] for s in review['sourceSites']]
        else:
            assert row['evidence'] == 'declared' and k == 'message'
            assert identities[f2]['place']['system'] == 'sys:offers'
            retained = [edge for edge in derived['componentEdges']
                        if (edge['kind'],edge['from'],edge['to'],edge['via']) == ('consume',f2,t2,v2)]
            assert retained, row
            disposition = 'recorded-subscription-outside-area'
            row_proof['sourceSites'] = [edge['site'] for edge in retained]
    elif k == 'data':
        missing = modes[row['label']] - {edge['native']['kind'] for edge in matched}
        if missing:
            assert review is not None and review['cause'] == 'legacy-owner-implied-access'
            assert missing == set(review['legacyOnlyModes'])
            disposition = 'canonical-occurrences-with-inferred-mode-removed'
            row_proof['removedInferredModes'] = sorted(missing)
    row_proof['disposition'] = disposition
    if matched:
        row_proof['nativeSites'] = [edge['native']['site'] for edge in matched]
    edge_proof.append(row_proof)

links = receipts / 'volvo-lineage.json.gz'
lineage = read(links)
range_rows = [row for row in lineage['landscape'] if row['nativeId'] == 'area:range']
assert range_rows and all(not row['problems'] for row in range_rows)
result = {
    'route': route, 'file': route_file, 'status': [200, 200],
    'frozenResponseSha256': sha(base / route_file), 'candidateResponseSha256': sha(release / route_file),
    'areaShard': area_shard, 'currentModelShard': current['model'], 'currentDerivedShard': current['derived'],
    'areaMetadata': {'onlyChangedField': 'id', 'evidenceCount': 36, 'collaborations': 1, 'relationships': 2},
    'valueFlow': {'bands': len(new_flow['bands']), 'columns': len(new_flow['columns']), **flow_checks},
    'nativeSystems': [{'id': id, 'components': len(s['components']), 'resources': len(s['resources'])}
                      for id,s in systems.items()],
    'frozenCards': component_proof, 'nativeGapCount': len(new['gaps']),
    'technical': {'frozen': len(old_edges), 'candidate': len(new_edges),
                  'candidateKinds': Counter(row['native']['kind'] for row in new_edges),
                  'dispositions': Counter(row['disposition'] for row in edge_proof), 'rows': edge_proof},
    'support': {str(path): sha(path) for path in (links, edge_reviews_file,
                receipts / 'node-preservation-audit.json.gz', receipts / 'volvo-evidence-counts.json')},
}
output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({key: value for key, value in result['technical'].items() if key != 'rows'}))
