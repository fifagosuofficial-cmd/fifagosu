"""Local-only QA server: clean URLs and read-only public API proxy."""
import argparse
import http.server
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UPSTREAM = "https://fifagosu.com"
ALLOWED = {
    "/api/summary", "/api/matches", "/api/player-teamcolors",
    "/api/prob", "/api/shop",
    "/api/fconline/v1/id", "/api/fconline/v1/user/basic",
    "/api/fconline/v1/user/maxdivision", "/api/fconline/v1/user/match",
    "/api/fconline/v1/match-detail", "/api/fconline/v1/ranker-stats",
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        target = urllib.parse.urlsplit(self.path)
        path = target.path
        if path in ('/calc', '/calc/', '/calc.html'):
            self.send_response(301)
            self.send_header('Location', '/sim/')
            self.end_headers()
            return
        if path.startswith("/api/community/"):
            data = b'{"enabled":false,"preview":true}'
            self.send_response(503)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path.startswith("/api/"):
            if path not in ALLOWED and not path.startswith("/api/static/fconline/meta/"):
                self.send_error(404, "API route not enabled in local QA")
                return
            if target.netloc or target.scheme or ".." in path:
                self.send_error(400)
                return
            try:
                request = urllib.request.Request(
                    UPSTREAM + path + ("?" + target.query if target.query else ""),
                    headers={"Accept": "application/json", "User-Agent": "FIFAGOSU-local-QA/1.0"},
                )
                try:
                    response = urllib.request.urlopen(request, timeout=45)
                except urllib.error.HTTPError as exc:
                    response = exc
                with response:
                    data = response.read()
                    self.send_response(response.status)
                    self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                    self.send_header("Content-Length", str(len(data)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    self.wfile.write(data)
            except (OSError, urllib.error.URLError):
                self.send_error(502, "Upstream API unavailable")
            return
        local = pathlib.Path(self.translate_path(path))
        if not local.exists() and not local.suffix and local.with_suffix(".html").is_file():
            self.path = path.rstrip("/") + ".html"
        super().do_GET()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--directory", default=str(ROOT / "dist-qa"))
    args = parser.parse_args()
    directory = pathlib.Path(args.directory).resolve()
    if not (directory / "diag.html").is_file():
        parser.error("Build dist-qa first")
    if not (directory / "data" / "news" / "feed.json").is_file():
        parser.error("Copy the data branch's data directory into dist-qa first")
    sys.path.insert(0, str(ROOT / "crawler"))
    import derive
    data = directory / "data"
    print("Generating local diagnosis data only...")
    date = derive.today_kst()
    print(derive.step_diag_market(data, date))
    print(derive.step_opponent_teamcolors(data, date))
    import functools
    handler = functools.partial(Handler, directory=str(directory))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Local QA: http://localhost:{args.port}/")
        server.serve_forever()

if __name__ == "__main__":
    main()
