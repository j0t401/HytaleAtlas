"""Serve Atlas locally without game files or a build step."""

import argparse
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
BUILD = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
ROOT_ID = hashlib.sha256(str(ROOT).encode()).hexdigest()[:16]


class AtlasServer(ThreadingHTTPServer):
    # Windows address reuse can otherwise allow two servers on one port.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class AtlasHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/atlas-health":
            payload = json.dumps({"app": "hytale-atlas", "build": BUILD, "root": ROOT_ID}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()


def existing_atlas(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/atlas-health", timeout=1) as response:
            record = json.loads(response.read())
        return (
            record.get("app") == "hytale-atlas"
            and record.get("build") == BUILD
            and record.get("root") == ROOT_ID
        )
    except (OSError, ValueError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65525:
        parser.error("El puerto debe estar entre 1024 y 65525.")
    handler = partial(AtlasHandler, directory=str(ROOT / "site"))
    for port in range(args.port, args.port + 10):
        try:
            server = AtlasServer(("127.0.0.1", port), handler)
            break
        except OSError:
            if existing_atlas(port):
                print(f"http://127.0.0.1:{port}/", flush=True)
                print("Esta versión del Atlas ya está abierta en esta carpeta.", flush=True)
                if not args.no_open:
                    webbrowser.open(f"http://127.0.0.1:{port}/")
                return
    else:
        raise SystemExit("No hay un puerto local disponible. Prueba: python serve.py --port 8800")
    url = f"http://127.0.0.1:{server.server_port}/"
    print(url, flush=True)
    print("Mantén esta ventana abierta. Para cerrar el servidor, pulsa Ctrl+C.", flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
