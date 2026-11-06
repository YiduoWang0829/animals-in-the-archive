"""Local development server that disables browser caching, so edits always show.

Usage (from the project folder):  python3 tools/serve.py [port]
Then open http://localhost:8000
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving on http://localhost:{port} (no browser caching)")
    ThreadingHTTPServer(("", port), NoCache).serve_forever()
