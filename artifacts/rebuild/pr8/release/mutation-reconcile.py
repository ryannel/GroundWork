"""Compare exact mutation sets for a test-only follow-up. GitHub still owns the merge gate."""

import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path

DETECTED = {'Killed', 'Timeout'}
UNDETECTED = {'Survived', 'NoCoverage'}
COMPLETED = DETECTED | UNDETECTED | {'Ignored'}


def report(file):
    contents = file.read_bytes()
    data = json.loads(contents)
    if data['thresholds']['break'] != 75:
        raise ValueError(f'The report uses a different break threshold: {file}')
    records = {}
    for name, item in data['files'].items():
        statuses = Counter(mutant['status'] for mutant in item['mutants'])
        if statuses.keys() - COMPLETED:
            raise ValueError(f'{name} has incomplete results in {file}')
        identity = Counter(
            (
                mutant['mutatorName'],
                mutant['replacement'],
                json.dumps(mutant['location'], sort_keys=True),
            )
            for mutant in item['mutants']
        )
        records[name] = (item['source'], identity, statuses)
    return records, sha256(contents).hexdigest()


def counts(records):
    statuses = Counter()
    for _, _, counts_for_file in records.values():
        statuses.update(counts_for_file)
    detected = sum(statuses[status] for status in DETECTED)
    undetected = sum(statuses[status] for status in UNDETECTED)
    total = detected + undetected
    return {
        'detected': detected,
        'assessed': total,
        'score': round(100 * detected / total, 4),
        'neededFor75': max(0, (3 * total + 3) // 4 - detected),
    }


def compare(original, replacements, expected):
    frozen = {}
    inputs = []
    batches = sorted(original.glob('*/mutation.json'))
    for file in batches:
        records, checksum = report(file)
        if frozen.keys() & records.keys():
            raise ValueError(f'Duplicate files in {file}')
        frozen.update(records)
        inputs.append({'batch': file.parent.name, 'sha256': checksum, 'files': len(records)})
    revised = frozen.copy()
    checks = []
    for file in replacements:
        records, checksum = report(file)
        for name, record in records.items():
            if name not in frozen or record[:2] != frozen[name][:2]:
                raise ValueError(f'{name} is absent or the source or mutation set differs in {file}')
        before = counts({name: revised[name] for name in records})
        revised.update(records)
        checks.append({
            'report': file.name,
            'sha256': checksum,
            'files': len(records),
            'before': before,
            'after': counts(records),
        })
    return {
        'completeBaseline': len(batches) == expected,
        'expectedBatches': expected,
        'inputs': inputs,
        'baseline': counts(frozen),
        'projections': checks,
        'projectedAggregate': counts(revised),
    }


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('original', type=Path)
parser.add_argument('replacements', nargs='*', type=Path)
parser.add_argument('--expected-batches', type=int, default=20)
args = parser.parse_args()
print(json.dumps(compare(args.original, args.replacements, args.expected_batches), indent=2))
