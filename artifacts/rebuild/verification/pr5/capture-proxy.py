import gzip,hashlib,json,urllib.request,urllib.error
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
root=Path('artifacts/rebuild/verification/pr5/recorded-production');root.mkdir(exist_ok=True)
class Capture(BaseHTTPRequestHandler):
 def do_GET(self):
  headers={key:value for key,value in self.headers.items() if key.lower() not in ['host','accept-encoding']};headers['Accept-Encoding']='identity'
  request=urllib.request.Request('http://127.0.0.1:3105'+self.path,headers=headers)
  try: response=urllib.request.urlopen(request,timeout=120)
  except urllib.error.HTTPError as error: response=error
  body=response.read();status=response.status;content=response.headers.get('Content-Type','')
  key=hashlib.sha256((self.path+'\n').encode()+body).hexdigest()
  (root/(key+'.body.gz')).write_bytes(gzip.compress(body,mtime=0))
  (root/(key+'.json')).write_text(json.dumps({'route':self.path,'status':status,'type':content,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'body':key+'.body.gz'},indent=2)+'\n')
  self.send_response(status);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(body)))
  if response.headers.get('Location'):self.send_header('Location',response.headers['Location'])
  self.end_headers();self.wfile.write(body)
ThreadingHTTPServer(('127.0.0.1',3106),Capture).serve_forever()
