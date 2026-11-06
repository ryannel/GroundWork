"""Record the exact responses consumed by rebuild:compare; reusable across builds and ports."""
import argparse, gzip, hashlib, json, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--upstream', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--port', type=int, default=0)
args = parser.parse_args()
root = Path(args.out)
root.mkdir(parents=True, exist_ok=True)
class Capture(BaseHTTPRequestHandler):
    def do_GET(self):
        headers = {key: value for key, value in self.headers.items() if key.lower() not in ['host', 'accept-encoding']}
        headers['Accept-Encoding'] = 'identity'
        request = urllib.request.Request(args.upstream + self.path, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=120)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read()
        key = hashlib.sha256((self.path + '\n').encode() + body).hexdigest()
        (root / (key + '.body.gz')).write_bytes(gzip.compress(body, mtime=0))
        (root / (key + '.json')).write_text(json.dumps({'route': self.path, 'status': response.status, 'type': response.headers.get('Content-Type', ''), 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'body': key + '.body.gz'}, indent=2) + '\n')
        self.send_response(response.status)
        self.send_header('Content-Type', response.headers.get('Content-Type', ''))
        self.send_header('Content-Length', str(len(body)))
        if response.headers.get('Location'):
            self.send_header('Location', response.headers['Location'])
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args):
        pass
server = ThreadingHTTPServer(('127.0.0.1', args.port), Capture)
print(json.dumps({'origin': 'http://127.0.0.1:' + str(server.server_port)}), flush=True)
server.serve_forever()
