#!/usr/bin/env python3
"""Static dev server that never caches, so ES module edits show up on reload."""
import http.server, socketserver, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            sys.stderr.write("404: %s\n" % (fmt % args))

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), NoCache) as httpd:
    print(f"serving on http://127.0.0.1:{port}")
    httpd.serve_forever()
