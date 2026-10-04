"""Fechas en UTC del scraper (datetime.now(datetime.UTC) lanzaba AttributeError).

Ejecutar desde scraper/:  python -m unittest discover -s tests -v
Solo usa las dependencias de requirements.txt; MongoDB y la descarga se sustituyen.
"""
import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import scraper  # noqa: E402
import server   # noqa: E402


def licitacion(id_):
    return scraper.Licitacion(id_, "Servicio de ciberseguridad", "", "PUB", "", "", "", "72212730", "", "", "prueba.atom")


class GuardarEnMongo(unittest.TestCase):
    def test_guarda_scraped_at_en_utc(self):
        cliente = mock.MagicMock()
        coleccion = cliente.__getitem__.return_value.__getitem__.return_value
        coleccion.bulk_write.return_value = mock.Mock(upserted_count=1, modified_count=0)

        with mock.patch.object(scraper, "MongoClient", return_value=cliente):
            guardadas = scraper.guardar_en_mongo([(licitacion("urn:1"), ["kw:CIBERSEGURIDAD"])], 2099, 12, "mongodb://x", "db")

        self.assertEqual(guardadas, 1)
        (ops,), _ = coleccion.bulk_write.call_args
        scraped_at = ops[0]._doc["$set"]["scraped_at"]
        self.assertIs(scraped_at.tzinfo, UTC)
        self.assertLess(abs(datetime.now(UTC) - scraped_at), timedelta(seconds=5))


class SyncTask(unittest.TestCase):
    def test_sincronizacion_sin_error_y_last_sync_en_utc(self):
        server._lock.acquire()
        with mock.patch.object(server, "descargar_zip_mes"), \
             mock.patch.object(server, "iterar_licitaciones_zip", return_value=iter([licitacion("urn:1")])), \
             mock.patch.object(server, "guardar_en_mongo", return_value=1), \
             mock.patch.object(Path, "exists", return_value=True), \
             mock.patch.object(Path, "mkdir"):
            server.sync_task(2099, 12)

        self.assertIsNone(server._status["last_error"])
        self.assertEqual(server._status["last_count"], 1)
        self.assertEqual(datetime.fromisoformat(server._status["last_sync"]).utcoffset(), timedelta(0))
        self.assertFalse(server._running)


if __name__ == "__main__":
    unittest.main()
