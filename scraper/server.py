#!/usr/bin/env python3
"""
Minimal HTTP server that exposes POST /sync to trigger the scraper
and GET /health to check its status. Runs inside Docker.
"""
import json, os, threading
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from scraper import (
    descargar_zip_mes, iterar_licitaciones_zip,
    es_ciberseguridad, guardar_en_mongo,
)

MONGO_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/cybersec_audit")
MONGO_DB  = os.environ.get("MONGO_DB",    "cybersec_audit")
PORT      = int(os.environ.get("SCRAPER_PORT", 8001))
WORK_DIR  = Path(os.environ.get("SCRAPER_WORK_DIR", "/tmp/scraper_zips"))

_lock    = threading.Lock()
_running = False
_status  = {"last_sync": None, "last_count": 0, "last_error": None}


def _mes_anterior():
    hoy      = datetime.now()
    anterior = hoy.replace(day=1) - timedelta(days=1)
    return anterior.year, anterior.month


def sync_task(anio, mes):
    global _running, _status
    try:
        WORK_DIR.mkdir(parents=True, exist_ok=True)
        ruta_zip = WORK_DIR / f"licitaciones_{anio}{mes:02d}.zip"
        if not ruta_zip.exists():
            descargar_zip_mes(anio, mes, ruta_zip)
        else:
            print(f"[=] Reutilizando {ruta_zip}")

        encontradas, total = [], 0
        for lic in iterar_licitaciones_zip(ruta_zip):
            total += 1
            ok, motivos = es_ciberseguridad(lic)
            if ok:
                encontradas.append((lic, motivos))
            if total % 5000 == 0:
                print(f"    ... {total} procesadas, {len(encontradas)} de ciber")

        stored = guardar_en_mongo(encontradas, anio, mes, MONGO_URI, MONGO_DB)
        _status = {
            "last_sync":  datetime.now(datetime.UTC).isoformat(),
            "last_count": stored,
            "last_error": None,
        }
        print(f"[sync] {anio}/{mes:02d}: {total} procesadas, {stored} guardadas en MongoDB")
    except Exception as exc:
        _status["last_error"] = str(exc)
        print(f"[sync] Error: {exc}")
    finally:
        global _running
        _running = False
        _lock.release()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "running": _running, **_status})
        else:
            self._json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        if not self.path.startswith("/sync"):
            self._json(404, {"ok": False, "error": "Not found"})
            return

        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        anio_default, mes_default = _mes_anterior()
        anio = int(params.get("anio", [anio_default])[0])
        mes  = int(params.get("mes",  [mes_default])[0])

        if not _lock.acquire(blocking=False):
            self._json(409, {"ok": False, "error": "Sync already in progress"})
            return

        global _running
        _running = True
        t = threading.Thread(target=sync_task, args=(anio, mes), daemon=True)
        t.start()
        self._json(202, {"ok": True, "message": f"Sync iniciado para {anio}/{mes:02d}"})

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"[scraper] Servidor HTTP en :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
