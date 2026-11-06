# All new PR5 baseline differences must be transport representation, not changed facts.
import argparse, collections, gzip, json
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--comparison',default='comparison-final')
args=parser.parse_args()
proof=Path('artifacts/rebuild/verification/pr5')
def load(path):
 return json.load(gzip.open(path)) if path.suffix=='.gz' else json.loads(path.read_text())
ledger={}
for workspace in ['personal','acme','volvo-cars']:
 current=proof/args.comparison/workspace
 previous=Path('artifacts/rebuild/verification/pr4/comparison')/workspace
 manifest=load(current/'manifest.json');old=load(previous/'manifest.json')
 assert manifest['routes']==old['routes']
 assert manifest['files']==old['files']
 before=load(previous/'facts.json.gz');after=load(current/'facts.json.gz')
 assert before==after,(workspace,'a business fact changed since PR4')
 rows=[]
 for name in manifest['files']:
  if name=='facts.json.gz':continue
  was=load(previous/name);now=load(current/name)
  for field in ['route','status','type','headings','links','payload']:
   assert was[field]==now[field],(workspace,name,field)
  if was.get('htmlBytes')!=now.get('htmlBytes'):
   rows.append({'file':name,'route':now['route'],'previousBytes':was['htmlBytes'],'currentBytes':now['htmlBytes'],'delta':now['htmlBytes']-was['htmlBytes']})
 comparison=load(current/'comparison.json.gz')
 assert all(row['path']=='/htmlBytes' for row in comparison['unexplained'])
 ledger[workspace]={'capture':str(current),'allFactsExactlyEqualToPr4':True,'factFields':list(after),'retainedTodayNodes':len(after['derived']['nodes']),'routesWithIdenticalStatusHeadingsLinksAndPayload':len(manifest['routes']),'transportChangesSincePr4':rows,'newDifferencesAreBytesOnly':True,'unexplainedAtCaptureTime':len(comparison['unexplained'])}
 print(workspace,len(after['derived']['nodes']),'retained nodes;',len(manifest['routes']),'identical route payloads;',dict(collections.Counter(row['delta'] for row in rows)))
(proof/'fidelity-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n')
