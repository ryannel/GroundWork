import json,gzip,collections,copy
from pathlib import Path
root=Path.cwd()
run=Path('artifacts/rebuild/verification/pr4/comparison')
def load(p):
 return json.load(gzip.open(p) if p.suffix=='.gz' else open(p))
def del_owner(x):
 y=copy.deepcopy(x)
 for z in y.get('stores',[]):z.pop('owner',None)
 return y
ledger={}
for workspace in ['personal','acme','volvo-cars']:
 before=root/'artifacts/rebuild/baseline'/workspace; after=root/run/workspace
 b=load(before/'facts.json.gz');a=load(after/'facts.json.gz');row={}
 unchanged=['attribution','authoredSystemEdges','codeHomes','explorer','keyTerms','landscape','languages','repositoryStates','scans','targets','workspace']
 for k in unchanged:assert b[k]==a[k],(workspace,k)
 row['unchangedAuthoredSections']=unchanged
 assert del_owner(b['plan'])==del_owner(a['plan']),workspace
 row['removedInferredOwners']=[{'id':x['id'],'owner':x['owner']} for x,y in zip(b['plan']['stores'],a['plan']['stores']) if x.get('owner')!=y.get('owner')]
 assert all(y.get('owner') is None for x,y in zip(b['plan']['stores'],a['plan']['stores']) if x.get('owner')!=y.get('owner'))
 for key in ['callers','handlerEdges','messages']:assert b['derived'][key]==a['derived'][key],(workspace,key)
 row['unchangedDerivedSections']=['callers','handlerEdges','messages']
 assert b['derived']['nodes'].keys()==a['derived']['nodes'].keys()
 for id,bn in b['derived']['nodes'].items():
  an=a['derived']['nodes'][id];bc=copy.deepcopy(bn);ac=copy.deepcopy(an)
  for k in ['ownerService','ownerTeam']:
   if bc.get(k)!=ac.get(k):assert ac.get(k) is None,(workspace,id,k)
   bc.pop(k,None);ac.pop(k,None)
  if bc['node'].get('owner')!=ac['node'].get('owner'):assert ac['node'].get('owner') is None
  bc['node'].pop('owner',None);ac['node'].pop('owner',None)
  assert bc==ac,(workspace,id,'node facts')
 row['allTodayNodeIdsAndNonOwnershipFieldsUnchanged']=len(a['derived']['nodes'])
 row['removedEdges']={}
 for key in ['componentEdges','systemEdges']:
  bx={x['id']:x for x in b['derived'][key]};ay={x['id']:x for x in a['derived'][key]}
  assert not ay.keys()-bx.keys()
  assert all(bx[id]==ay[id] for id in ay)
  removed=[bx[id] for id in sorted(bx.keys()-ay.keys())]
  assert all(x.get('steps')==[] and not x.get('handlers') and x['kind']=='data' for x in removed)
  row['removedEdges'][key]=removed
  row[key+'RetainedExactly']=len(ay)
 assert b['lookupFacts'].keys()==a['lookupFacts'].keys()
 changed=collections.Counter()
 for id,x in b['lookupFacts'].items():
  y=a['lookupFacts'][id]
  for key in x.keys()|y.keys():
   if x.get(key)!=y.get(key):
    assert key in ['component','domain','system','sources','sourcesOf'],(workspace,id,key)
    changed[key]+=1
 row['lookupChangesByField']=dict(changed)
 areas=[]
 for x,y in zip(b['areaViews'],a['areaViews']):
  assert x['area']==y['area']
  for key in ['collaborations','limitation','relationships','reviewed','scope','workspace']:assert x.get(key)==y.get(key),(workspace,x['area']['id'],key)
  if 'valueFlow' in x:assert x['valueFlow']==y.get('valueFlow'),(workspace,x['area']['id'],'lost authored valueFlow')
  bx={c['id']:(s['id'],c) for s in x['systems'] for c in s['components']};ay={c['id']:(s['id'],c) for s in y['systems'] for c in s['components']}
  lost=bx.keys()-ay.keys(); userrefs={z['id'] for s in y['systems'] for c in s['components'] for z in c['resources']}
  assert not lost-userrefs,(workspace,x['area']['id'],lost-userrefs)
  for id in bx.keys()&ay.keys():
   bc=copy.deepcopy(bx[id][1]);ac=copy.deepcopy(ay[id][1]);bc.pop('parentComponent',None);ac.pop('parentComponent',None)
   if bc.get('repository')!=ac.get('repository'):
    assert bc.get('repository') is None and ac.get('repository') is not None
    assert ac['repository']['name'] in {source['repo'] for source in a['attribution'][id]['sources']}
    bc['repository']=ac['repository']
   assert bc==ac,(workspace,x['area']['id'],id)
  be={z['id']:z for z in x['technicalRelationships']};ae={z['id']:z for z in y['technicalRelationships']}
  for id in be.keys()&ae.keys():
   bc=copy.deepcopy(be[id]);ac=copy.deepcopy(ae[id]);
   for k in ['fromSystem','toSystem']:bc.pop(k,None);ac.pop(k,None)
   assert bc==ac,(workspace,x['area']['id'],id)
  if x!=y:areas.append({'area':x['area']['id'],'removedMisplacedCardsStillListedAsResources':sorted(lost),'addedSystems':sorted({s['id'] for s in y['systems']}-{s['id'] for s in x['systems']}),'movedCards':[{'id':id,'before':bx[id][0],'after':ay[id][0]} for id in sorted(bx.keys()&ay.keys()) if bx[id][0]!=ay[id][0]],'authoredDiagramRetained':x.get('valueFlow')==y.get('valueFlow') if 'valueFlow' in x else None})
 row['areaCorrections']=areas
 assert len(b['plans'])==len(a['plans'])
 for x,y in zip(b['plans'],a['plans']):
  assert x['outline']==y['outline'],(workspace,x['slug'],'outline')
  assert {k:v for k,v in x['loaded'].items() if k!='plan'}=={k:v for k,v in y['loaded'].items() if k!='plan'}
  assert {k:v for k,v in x['loaded']['plan'].items() if k not in ['services','stores']}=={k:v for k,v in y['loaded']['plan'].items() if k not in ['services','stores']}
  for side in ['before','after']:
   bn=x[side]['nodes'];an=y[side]['nodes'];assert not an.keys()-bn.keys()
   for id in bn.keys()-an.keys():assert workspace=='volvo-cars' and x['slug']=='unify-price-breakdown' and id in ['svc:assortment-admin-api','st:assortment-admin-db']
   for id in an:
    bc=copy.deepcopy(bn[id]);ac=copy.deepcopy(an[id])
    for k in ['ownerService','ownerTeam']:
     if bc.get(k)!=ac.get(k):assert ac.get(k) is None
     bc.pop(k,None);ac.pop(k,None)
    for z in [bc['node'],ac['node']]:z.pop('$path',None);z.pop('owner',None)
    assert bc==ac,(workspace,x['slug'],side,id,'retained node facts')
   for key in ['componentEdges','systemEdges']:
    bx={z['id']:z for z in x[side][key]};ay={z['id']:z for z in y[side][key]}
    assert not ay.keys()-bx.keys()
    assert all(bx[id]==ay[id] for id in ay)
    assert all(not bx[id].get('steps') and not bx[id].get('handlers') for id in bx.keys()-ay.keys())
  for key in ['services','stores']:
   bx={z['id']:z for z in x['loaded']['plan'].get(key,[])};ay={z['id']:z for z in y['loaded']['plan'].get(key,[])}
   assert not ay.keys()-bx.keys()
   for id in ay:
    bc=copy.deepcopy(bx[id]);ac=copy.deepcopy(ay[id]);bc.pop('owner',None);ac.pop('owner',None);assert bc==ac
   for id in bx.keys()-ay.keys():
    assert workspace=='volvo-cars' and x['slug']=='unify-price-breakdown' and id in ['svc:assortment-admin-api','st:assortment-admin-db']
    other={k:v for k,v in x['loaded']['plan'].items() if k not in ['services','stores']}
    assert id not in json.dumps(other)
 row['plansHaveUnchangedOpsAndReasoning']=len(a['plans'])
 bm=load(before/'manifest.json');am=load(after/'manifest.json');assert set(bm['routes'])<=set(am['routes'])
 row['routeAdditions']=sorted(set(am['routes'])-set(bm['routes']))
 row['comparisonPointers']=len(load(after/'reviewed-differences.json.gz')['changes'])
 ledger[workspace]=row
print(json.dumps(ledger,indent=2,sort_keys=True))
