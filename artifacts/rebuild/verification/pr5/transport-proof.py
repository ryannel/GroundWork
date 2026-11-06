import argparse, collections, gzip, hashlib, json, re, urllib.request
from pathlib import Path

proof=Path('artifacts/rebuild/verification/pr5')
oldroot=Path('artifacts/rebuild/verification/pr4/comparison')
parser=argparse.ArgumentParser()
parser.add_argument('--verify',action='store_true')
parser.add_argument('--comparison',default='comparison')
parser.add_argument('--report',default='transport-proof.json')
args=parser.parse_args()
report=proof/args.report
raw=proof/'transport-responses'
raw.mkdir(exist_ok=True)
builds=json.loads((proof/'transport-builds.json').read_text())
chunk=re.compile(r'/_next/static/chunks/[a-z0-9_-]+\.(?:css|js)')
frames=re.compile(r'<script>self\.__next_f\.push\((.*?)\)</script>',re.S)
router=re.compile(r'("n":"domain","t":"d","k":"[^"]+","s":\["areas","assets",)"entries",')

def load(path): return json.load(gzip.open(path)) if path.suffix=='.gz' else json.loads(path.read_text())
def flight_rows(flight):
 data=flight.encode();offset=0
 while offset<len(data):
  if data[offset:offset+1]==b'\n':offset+=1;continue
  header=re.compile(rb'([0-9a-f]*):').match(data,offset)
  assert header is not None,('Unrecognised Flight row',data[offset:offset+40])
  identity=header[1].decode();offset=header.end()
  text=re.compile(rb'T([0-9a-f]+),').match(data,offset) if identity else None
  if text is not None:
   start=text.end();end=start+int(text[1],16)
   yield identity,'text',data[start:end].decode()
   offset=end;continue
  end=data.find(b'\n',offset)
  if end==-1:end=len(data)
  yield identity,'row',data[offset:end].decode()
  offset=end+1

# Flight row numbers and delivery order are technical identities. Compare their complete
# referenced value graph instead: all literals, import definitions, array order and
# property selectors remain checked. Authored Groundwork identities are never rewritten.
def semantic_graph(flight):
 records={};hints=[]
 for identity,row_kind,body in flight_rows(flight):
  if identity=='':hints.append(body);continue
  if row_kind=='text':
   assert identity not in records
   records[identity]={'kind':'text','value':body};continue
  if body in ['X','C']:
   control=records.setdefault(identity,{'kind':'control','value':[]})
   assert control['kind']=='control'
   control['value'].append(body);continue
  kind='I' if body.startswith('I') else 'value'
  assert identity not in records,('Duplicate Flight value record',identity)
  records[identity]={'kind':kind,'value':json.loads(body[1:] if kind=='I' else body)}
 reference=re.compile(r'^\$(L|@)?([0-9a-f]+)(:.*)?$')
 def values(value,colours):
  if isinstance(value,list):return [values(child,colours) for child in value]
  if isinstance(value,dict):return {key:values(child,colours) for key,child in value.items()}
  match=reference.fullmatch(value) if isinstance(value,str) else None
  if match is None:return value
  kind,identity,selector=match.groups()
  assert identity in records,('Unknown Flight reference',value)
  return {'flightReference':kind or 'value','record':colours[identity],'selector':selector}
 colours={identity:'reference' for identity in records}
 for _ in range(len(records)+1):
  colours={identity:hashlib.sha256(json.dumps(values(record,colours),sort_keys=True).encode()).hexdigest() for identity,record in records.items()}
 return {'root':colours['0'],'records':sorted(colours.values()),'hints':hints}

def dissect(html, version, route):
 payload=[];count=0
 def frame(match):
  nonlocal count
  value=json.loads(match[1])
  if value[0]!=1:return match[0]
  payload.append(value[1]);count+=1;return ''
 shell=frames.sub(frame,html);flight=''.join(payload)
 assets=sum(len(match[0].encode())-len('CHUNK') for match in chunk.finditer(shell+flight))
 shell=chunk.sub('CHUNK',shell);flight=chunk.sub('CHUNK',flight)
 for key,build in builds.items():
  if key==version or key.startswith(version+'-'):flight=flight.replace(build,'BUILD_ID')
 known_dom=known_flight=router_count=0
 if version=='pr5':
  flight,router_count=router.subn(r'\1',flight)
  known_flight+=router_count*12
  if route=='/':
   needle='2<!-- --> <!-- -->more '
   assert shell.count(needle)==1,(route,'library text boundary')
   shell=shell.replace(needle,'2<!-- --> more ');known_dom=8
   needle='"children":[2," ","more ","plans"," →"]'
   assert flight.count(needle)==1,(route,'library Flight text boundary')
   flight=flight.replace(needle,'"children":[2," more ","plans"," →"]');known_flight+=5
 flight=semantic_graph(flight)
 return {'shell':shell,'flight':flight,'wrappers':count,'assetBytes':assets,'knownDomBytes':known_dom,'knownFlightBytes':known_flight,'routerEntries':router_count}

if args.verify:
 fixture='0:["$1","$2"]\n1:{"id":"h:confirm#tx/save"}\n2:{"name":"Beta"}\n'
 renamed='0:["$a","$b"]\nb:{"name":"Beta"}\na:{"id":"h:confirm#tx/save"}\n'
 assert semantic_graph(fixture)==semantic_graph(renamed)
 assert semantic_graph(fixture)!=semantic_graph(renamed.replace('["$a","$b"]','["$b","$a"]'))
 assert semantic_graph(fixture)!=semantic_graph(renamed.replace('h:confirm#tx/save','h:confirm#tx/other'))
 text='sequenceDiagram\n A->>B: Café'
 text_flight='0:"$1"\n1:T'+format(len(text.encode()),'x')+','+text
 assert semantic_graph(text_flight)!=semantic_graph(text_flight.replace('Café','Cafè'))
 rows=load(report)
 for row in rows:
  parts={}
  for version,sample in row['samples'].items():
   body=gzip.decompress((raw/sample['raw']).read_bytes())
   assert hashlib.sha256(body).hexdigest()==sample['sha256']
   assert len(body)==sample['bytes']
   parts[version]=dissect(body.decode(),version,row['route'])
  old=parts['pr4'];new=parts['pr5']
  assert old['shell']==new['shell'],row['route']
  assert old['flight']==new['flight'],row['route']
  delta=new['knownDomBytes']+new['knownFlightBytes']+(new['wrappers']-old['wrappers'])*43+new['assetBytes']-old['assetBytes']
  assert delta==row['samples']['pr5']['bytes']-row['samples']['pr4']['bytes'],row['route']
 print('Verified',len(rows),'exact raw response pairs offline; authored identities, value changes and array order remain checked.')
 raise SystemExit(0)

rows=[];seen={}
for workspace in ['personal','acme','volvo-cars']:
 folder=proof/args.comparison/workspace
 comparison=load(folder/'comparison.json')
 for change in comparison['unexplained']:
  assert change['path']=='/htmlBytes'
  previous=load(oldroot/workspace/change['file']);current=load(folder/change['file']);route=current['route']
  key=(route,previous['htmlBytes'],current['htmlBytes'])
  if key in seen:
   rows.append({**seen[key],'workspace':workspace,'file':change['file']});continue
  samples={};observations={};normalised={}
  for version,port,wanted in [('pr4',3104,previous['htmlBytes']),('pr5',3105,current['htmlBytes'])]:
   if version=='pr5':
    witnesses=[load(path) for path in (proof/'recorded-production').glob('*.json')]
    recorded=next(witness for witness in witnesses if witness['route']==route and witness['bytes']==wanted)
    body=gzip.decompress((proof/'recorded-production'/recorded['body']).read_bytes())
    assert hashlib.sha256(body).hexdigest()==recorded['sha256']
   else:
    request=urllib.request.urlopen(f'http://127.0.0.1:{port}{route}',timeout=120)
    body=request.read()
    assert request.status==current['status'],(route,version,request.status)
   size=len(body);html=body.decode()
   file=f'{change["file"][:-8]}-{version}-{hashlib.sha256(body).hexdigest()[:16]}.html.gz'
   (raw/file).write_bytes(gzip.compress(body,mtime=0))
   observations[version]=[size]
   samples[version]={'bytes':size,'raw':file,'sha256':hashlib.sha256(body).hexdigest()}
   normalised[version]=dissect(html,version,route)
  old=normalised['pr4'];new=normalised['pr5']
  assert old['shell']==new['shell'],(route,'unexplained rendered HTML difference')
  assert old['flight']==new['flight'],(route,'unexplained decoded Flight difference')
  wrapper_delta=(new['wrappers']-old['wrappers'])*43
  asset_delta=new['assetBytes']-old['assetBytes']
  expected_delta=new['knownDomBytes']+new['knownFlightBytes']+wrapper_delta+asset_delta
  actual_delta=current['htmlBytes']-samples['pr4']['bytes']
  assert actual_delta==expected_delta,(route,actual_delta,expected_delta)
  row={'workspace':workspace,'file':change['file'],'route':route,'previousBytes':previous['htmlBytes'],'previousReplayBytes':samples['pr4']['bytes'],'previousCaptureVsReplayDelta':samples['pr4']['bytes']-previous['htmlBytes'],'currentBytes':current['htmlBytes'],'delta':actual_delta,'samples':samples,'observations':observations,'identicalNormalisedHtmlAndFlight':True,'knownDomBytes':new['knownDomBytes'],'knownEscapedFlightBytes':new['knownFlightBytes'],'routerEntriesAdded':new['routerEntries'],'wrapperDeltaBytes':wrapper_delta,'assetDeltaBytes':asset_delta,'wrapperCounts':{v:normalised[v]['wrappers'] for v in ['pr4','pr5']}}
  rows.append(row);seen[key]=row
  print(workspace,route,actual_delta,'accounted for',flush=True)
 report.write_text(json.dumps(rows,indent=2)+'\n')
print('Verified',len(rows),'exact differences.',flush=True)
