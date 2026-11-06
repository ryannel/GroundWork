"""Prove exact recorded transport differences without repeated manual captures.
Flight parser copied unchanged from the verified PR5 proof; literals and array order remain checked.
"""
import argparse, gzip, hashlib, json, re, urllib.request
from pathlib import Path

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


parser=argparse.ArgumentParser()
parser.add_argument('--previous-origin')
parser.add_argument('--previous-recorded')
parser.add_argument('--verify',action='store_true')
parser.add_argument('--previous-build-id')
parser.add_argument('--current-build-id',default='.next/BUILD_ID')
parser.add_argument('--previous',default='artifacts/rebuild/verification/pr6/comparison')
parser.add_argument('--current',default='artifacts/rebuild/verification/migration-readiness/comparison')
parser.add_argument('--recorded',default='artifacts/rebuild/verification/migration-readiness/recorded-production')
parser.add_argument('--out',default='artifacts/rebuild/verification/migration-readiness/transport')
args=parser.parse_args()
root=Path(args.out);root.mkdir(parents=True,exist_ok=True)
builds=json.loads((root/'builds.json').read_text()) if args.verify else [Path(args.previous_build_id).read_text().strip(),Path(args.current_build_id).read_text().strip()]
if not args.verify:(root/'builds.json').write_text(json.dumps(builds)+'\n')
chunk=re.compile(r'/_next/static/chunks/[a-z0-9_-]+\.(?:css|js)')
frames=re.compile(r'<script>self\.__next_f\.push\((.*?)\)</script>',re.S)
def load(path):
 if not path.exists() and path.suffix=='.json':path=path.with_suffix('.json.gz')
 return json.load(gzip.open(path)) if path.suffix=='.gz' else json.loads(path.read_text())
def dissect(body):
 html=body.decode();payload=[];count=0
 def frame(match):
  nonlocal count
  value=json.loads(match[1])
  if value[0]!=1:return match[0]
  payload.append(value[1]);count+=1;return ''
 shell=frames.sub(frame,html);flight=''.join(payload)
 assets=sum(len(match[0].encode())-len('CHUNK') for match in chunk.finditer(shell+flight))
 shell=chunk.sub('CHUNK',shell);flight=chunk.sub('CHUNK',flight)
 for build in builds:flight=flight.replace(build,'BUILD_ID')
 return {'shell':shell,'flight':semantic_graph(flight),'wrappers':count,'assetBytes':assets}
def retain(body,label):
 name=label+'-'+hashlib.sha256(body).hexdigest()+'.html.gz'
 (root/name).write_bytes(gzip.compress(body,mtime=0))
 return {'body':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()}
# The same four controls used by the PR5 proof: row identities may change, model ids and order may not.
fixture='0:["$1","$2"]\n1:{"id":"h:confirm#tx/save"}\n2:{"name":"Beta"}\n'
renamed='0:["$a","$b"]\nb:{"name":"Beta"}\na:{"id":"h:confirm#tx/save"}\n'
assert semantic_graph(fixture)==semantic_graph(renamed)
assert semantic_graph(fixture)!=semantic_graph(renamed.replace('["$a","$b"]','["$b","$a"]'))
assert semantic_graph(fixture)!=semantic_graph(renamed.replace('h:confirm#tx/save','h:confirm#tx/other'))
text='sequenceDiagram\n A->>B: Café'
encoded='0:"$1"\n1:T'+format(len(text.encode()),'x')+','+text
assert semantic_graph(encoded)!=semantic_graph(encoded.replace('Café','Cafè'))
if args.verify:
 rows=load(root/'proof.json')
 for row in rows:
  parts=[]
  for key in ['previous','current']:
   sample=row[key];body=gzip.decompress((root/sample['body']).read_bytes())
   assert hashlib.sha256(body).hexdigest()==sample['sha256']
   assert len(body)==sample['bytes']
   parts.append(dissect(body))
  before,after=parts
  assert before['shell']==after['shell'],row['route']
  assert before['flight']==after['flight'],row['route']
  assert row['current']['bytes']-row['previous']['bytes']==(after['wrappers']-before['wrappers'])*43+after['assetBytes']-before['assetBytes'],row['route']
 print('Verified',len(rows),'exact recorded transport pairs offline; complete values and array order remain checked.')
 raise SystemExit(0)
recorded=[load(path) for path in Path(args.recorded).glob('*.json')]
previous_recorded=Path(args.previous_recorded) if args.previous_recorded else None
previous_rows=load(previous_recorded/'proof.json') if previous_recorded and (previous_recorded/'proof.json').exists() else []
previous_captures=[load(path) for path in previous_recorded.glob('*.json') if path.name != 'proof.json'] if previous_recorded else []
rows=[]
for workspace in ['personal','acme','volvo-cars']:
 current=Path(args.current)/workspace;previous=Path(args.previous)/workspace
 manifest=load(current/'manifest.json')
 for file in manifest['files']:
  if file=='facts.json.gz':continue
  now=load(current/file);was=load(previous/file)
  if now['htmlBytes']==was['htmlBytes']:continue
  change={'file':file,'path':'/htmlBytes','before':was['htmlBytes'],'after':now['htmlBytes']}
  for field in ['route','status','type','headings','links','payload']:assert now[field]==was[field],(workspace,field)
  matches=[item for item in recorded if item['route']==now['route'] and item['bytes']==now['htmlBytes']]
  assert len(matches)==1,(now['route'],len(matches))
  witness=matches[0]
  new=gzip.decompress((Path(args.recorded)/witness['body']).read_bytes())
  assert hashlib.sha256(new).hexdigest()==witness['sha256']
  observations=[];old=None
  witnesses=[row['previous'] for row in previous_rows if row['route']==now['route'] and row['previous']['bytes']==was['htmlBytes']]
  if witnesses:
   sample=witnesses[0];old=gzip.decompress((previous_recorded/sample['body']).read_bytes())
   assert hashlib.sha256(old).hexdigest()==sample['sha256']
   assert len(old)==was['htmlBytes']
   observations.append(retain(old,'previous'))
  if old is None and previous_recorded:
   candidates=[item for item in previous_captures if isinstance(item,dict) and item.get('route')==now['route'] and item.get('bytes')==was['htmlBytes']]
   for sample in candidates:
    candidate=gzip.decompress((previous_recorded/sample['body']).read_bytes())
    assert hashlib.sha256(candidate).hexdigest()==sample['sha256']
    if len(candidate)==was['htmlBytes']:
     old=candidate;observations.append(retain(old,'previous'));break
  for attempt in range(12):
   if old is not None:break
   assert args.previous_origin,'No recorded previous witness; supply --previous-origin'
   request=urllib.request.Request(args.previous_origin+now['route'],headers={'User-Agent':'node','Accept':'*/*','Accept-Language':'*','Sec-Fetch-Mode':'cors','Accept-Encoding':'identity'})
   response=urllib.request.urlopen(request,timeout=120);candidate=response.read()
   assert response.status==was['status']
   observations.append(retain(candidate,'previous'))
   if len(candidate)==was['htmlBytes']:old=candidate;break
  assert old is not None,(now['route'],'No exact previous captured-size witness',was['htmlBytes'],[item['bytes'] for item in observations])
  before=dissect(old);after=dissect(new)
  assert before['shell']==after['shell'],(now['route'],'Rendered HTML changed')
  assert before['flight']==after['flight'],(now['route'],'Hydrated values changed')
  wrapper=(after['wrappers']-before['wrappers'])*43
  assets=after['assetBytes']-before['assetBytes']
  assert len(new)-len(old)==wrapper+assets,(now['route'],'Unaccounted transport bytes')
  row={'workspace':workspace,'file':change['file'],'route':now['route'],'pointer':change,'previous':retain(old,'previous'),'current':retain(new,'current'),'observations':observations,'allDomAndHydratedValuesEqual':True,'wrapperDeltaBytes':wrapper,'assetDeltaBytes':assets,'measuredDelta':len(new)-len(old)}
  rows.append(row)
  (root/'proof.json').write_text(json.dumps(rows,indent=2)+'\n')
  print(workspace,now['route'],'proved',len(new)-len(old),'bytes',flush=True)
print('Verified',len(rows),'exact response pairs; no authored ids, values or array order normalised.',flush=True)
