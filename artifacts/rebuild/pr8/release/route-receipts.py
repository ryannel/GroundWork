from collections import Counter
from difflib import SequenceMatcher
from hashlib import sha256
from pathlib import Path
import gzip
import json
import sys

old = Path('artifacts/rebuild/baseline')
current = Path(sys.argv[1])

def snapshot(root, w, file):
    data = (root / w / file).read_bytes()
    return json.loads(gzip.decompress(data) if file.endswith('.gz') else data), sha256(data).hexdigest()

def list_changes(before, after):
    a, b = Counter(before), Counter(after)
    return {'removed': list((a-b).elements()), 'added': list((b-a).elements())}

def text_samples(before, after):
    if before == after:
        return []
    first = before.split()
    second = after.split()
    blocks = SequenceMatcher(a=first, b=second).get_opcodes()
    return [
        {'old': ' '.join(first[i:i2])[:150], 'new': ' '.join(second[j:j2])[:150], 'words': [i2-i, j2-j]}
        for kind, i, i2, j, j2 in blocks if kind != 'equal'
    ][:15]

def receipts(w):
    a, old_manifest = snapshot(old, w, 'manifest.json')
    b, new_manifest = snapshot(current, w, 'manifest.json')
    assert set(a['routes']) <= set(b['routes'])
    rows = {}
    for route in b['routes']:
        file = 'route-' + sha256((json.dumps(route, ensure_ascii=False)+'\n').encode()).hexdigest()[:20] + '.json.gz'
        after, after_sha = snapshot(current, w, file)
        before, before_sha = snapshot(old, w, file) if route in a['routes'] else (None, None)
        assert after['route'] == route and after['status'] == 200
        row = {'file': file, 'sha256': [before_sha, after_sha], 'status': [before['status'] if before else None, after['status']], 'type': after['type'], 'bytes': [before['htmlBytes'] if before else None, after['htmlBytes']]}
        rows[route] = row
        if before is None:
            continue
        assert before['route'] == route and before['status'] == after['status'] and before['type'] == after['type']
        row['links'] = list_changes(before['links'], after['links'])
        row['headings'] = list_changes(before['headings'], after['headings'])
        if after['type'] == 'text/html':
            row['inspectedIds'] = list_changes(before['payload']['inspectedIds'], after['payload']['inspectedIds'])
            before_text = before['payload']['text']
            after_text = after['payload']['text']
            row['text'] = {'sha256': [sha256(t.encode()).hexdigest() for t in (before_text, after_text)], 'samples':text_samples(before_text, after_text)}
        else:
            row['payloadFields'] = {
                'equal': [k for k in before['payload'] if k in after['payload'] and before['payload'][k] == after['payload'][k]],
                'removed': [k for k in before['payload'] if k not in after['payload']],
                'added': [k for k in after['payload'] if k not in before['payload']],
                'changed': [k for k in before['payload'] if k in after['payload'] and before['payload'][k] != after['payload'][k]],
            }
    return {'workspace':w, 'manifestSha256':[old_manifest,new_manifest], 'newRoutes': sorted(set(b['routes'])-set(a['routes'])), 'routes':rows}

for w in sys.argv[2:]:
    proof = receipts(w)
    data = (json.dumps(proof, ensure_ascii=False, indent=2)+'\n').encode()
    file = Path('/private/tmp/pr8-release-route-receipts-' + w + '.json.gz')
    file.write_bytes(gzip.compress(data, mtime=0))
    print(w, len(proof['routes']), len(proof['newRoutes']), sha256(data).hexdigest(), file)
