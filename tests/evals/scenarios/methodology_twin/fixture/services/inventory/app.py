"""Stockroom inventory API — stdlib HTTP server, no external deps."""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from capture_queue import CaptureQueue

QUEUE = CaptureQueue(Path(".data/capture-queue.json"))
COUNTS = {}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json({"ok": True})
        elif self.path == "/counts":
            self._json(COUNTS)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/counts":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            COUNTS[body["sku"]] = body["count"]
            self._json({"queued": QUEUE.capture(body)})
        else:
            self.send_error(404)

    def _json(self, obj):
        payload = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8090), Handler).serve_forever()
