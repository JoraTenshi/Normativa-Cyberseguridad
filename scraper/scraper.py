#!/usr/bin/env python3
from __future__ import annotations

import argparse, os, re, sys, zipfile
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterator
from xml.etree import ElementTree as ET

import requests
from pymongo import MongoClient, UpdateOne

URL_BASE_MES = (
    "https://contrataciondelsectorpublico.gob.es/sindicacion/"
    "sindicacion_643/licitacionesPerfilesContratanteCompleto3_{anio}{mes:02d}.zip"
)

PALABRAS_CIBERSEGURIDAD = [
    "CIBERSEGURIDAD", "CIBER SEGURIDAD", "CIBERATAQUE", "CIBERDEFENSA",
    "CYBERSECURITY", "SEGURIDAD INFORMATICA", "SEGURIDAD INFORMÁTICA",
    "SEGURIDAD DE LA INFORMACION", "SEGURIDAD DE LA INFORMACIÓN",
    "SEGURIDAD TIC", "SEGURIDAD DIGITAL",
    "SOC ", "CENTRO DE OPERACIONES DE SEGURIDAD",
    "SIEM", "EDR", "XDR", "MDR", "NDR", "DLP", "WAF", "IDS", "IPS",
    "PENTEST", "PENTESTING", "AUDITORIA DE SEGURIDAD",
    "AUDITORÍA DE SEGURIDAD", "HACKING ETICO", "HACKING ÉTICO",
    "RED TEAM", "BLUE TEAM", "PURPLE TEAM",
    "VULNERABILID",
    "ENS ", "ESQUEMA NACIONAL DE SEGURIDAD",
    "ISO 27001", "ISO27001", "ISO/IEC 27001",
    "RGPD", "PROTECCION DE DATOS", "PROTECCIÓN DE DATOS",
    "FIREWALL", "CORTAFUEGOS",
    "ANTIVIRUS", "ANTI-MALWARE", "ANTIMALWARE", "MALWARE",
    "PHISHING", "RANSOMWARE",
    "CIFRADO", "ENCRIPTACION", "ENCRIPTACIÓN", "PKI",
    "IAM", "GESTION DE IDENTIDADES", "GESTIÓN DE IDENTIDADES",
    "ZERO TRUST", "MFA", "AUTENTICACION MULTIFACTOR",
    "AUTENTICACIÓN MULTIFACTOR",
    "RESPUESTA A INCIDENTES", "INCIDENT RESPONSE",
    "FORENSE DIGITAL", "ANALISIS FORENSE", "ANÁLISIS FORENSE",
    "BASTIONADO", "HARDENING",
]

CPV_CIBERSEGURIDAD_PREFIJOS = (
    "72212730", "72212731", "72212732",
    "48730000", "48731000", "48732000",
    "35120000", "79417000",
)

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "at":   "http://purl.org/atompub/tombstones/1.0",
}


@dataclass
class Licitacion:
    id: str
    titulo: str
    resumen: str
    estado: str
    importe: str
    moneda: str
    organo_contratacion: str
    cpv: str
    fecha_actualizacion: str
    enlace: str
    fichero_origen: str

    def texto_busqueda(self) -> str:
        partes = [self.titulo, self.resumen, self.cpv, self.organo_contratacion]
        return " ".join(p for p in partes if p).upper()


def descargar_zip_mes(anio: int, mes: int, destino: Path) -> Path:
    url = URL_BASE_MES.format(anio=anio, mes=mes)
    destino.parent.mkdir(parents=True, exist_ok=True)
    print(f"[+] Descargando {url}")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(destino, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                f.write(chunk)
    print(f"[+] Guardado en {destino} ({destino.stat().st_size / 1e6:.1f} MB)")
    return destino


def _texto(elem):
    return elem.text.strip() if (elem is not None and elem.text) else ""


def _buscar_local(elem, local_name):
    for hijo in elem.iter():
        if hijo.tag.split("}", 1)[-1] == local_name:
            return hijo
    return None


def _todos_local(elem, local_name):
    return [h for h in elem.iter() if h.tag.split("}", 1)[-1] == local_name]


def parsear_entry(entry, fichero_origen):
    if entry.tag.endswith("deleted-entry"):
        return None

    id_lic     = _texto(entry.find("atom:id", NS))
    titulo     = _texto(entry.find("atom:title", NS))
    resumen    = _texto(entry.find("atom:summary", NS))
    actualizado = _texto(entry.find("atom:updated", NS))

    enlace = ""
    link_elem = entry.find("atom:link", NS)
    if link_elem is not None:
        enlace = link_elem.attrib.get("href", "")

    organo = importe = moneda = estado = cpv = ""

    organo_elem = _buscar_local(entry, "PartyName")
    if organo_elem is not None:
        organo = _texto(_buscar_local(organo_elem, "Name"))

    for nombre in ("TotalAmount", "EstimatedOverallContractAmount", "TaxExclusiveAmount"):
        amt = _buscar_local(entry, nombre)
        if amt is not None and amt.text:
            importe = amt.text.strip()
            moneda  = amt.attrib.get("currencyID", "")
            break

    estado = _texto(_buscar_local(entry, "ContractFolderStatusCode"))

    cpvs = [c.text.strip() for c in _todos_local(entry, "ItemClassificationCode") if c.text]
    cpv  = ", ".join(dict.fromkeys(cpvs))

    return Licitacion(id_lic, titulo, resumen, estado, importe, moneda,
                      organo, cpv, actualizado, enlace, fichero_origen)


def iterar_licitaciones_zip(ruta_zip: Path) -> Iterator[Licitacion]:
    with zipfile.ZipFile(ruta_zip) as zf:
        atoms = sorted(n for n in zf.namelist() if n.lower().endswith(".atom"))
        print(f"[+] {len(atoms)} ficheros .atom en el ZIP")
        for nombre in atoms:
            with zf.open(nombre) as fh:
                ctx = ET.iterparse(fh, events=("end",))
                for _, elem in ctx:
                    tag = elem.tag.split("}", 1)[-1]
                    if tag in ("entry", "deleted-entry"):
                        lic = parsear_entry(elem, nombre)
                        if lic is not None:
                            yield lic
                        elem.clear()


def es_ciberseguridad(lic: Licitacion):
    motivos = []
    texto   = lic.texto_busqueda()
    for kw in PALABRAS_CIBERSEGURIDAD:
        if kw in texto:
            motivos.append(f"kw:{kw.strip()}")
    if lic.cpv:
        for codigo in re.split(r"[,\s]+", lic.cpv):
            for prefijo in CPV_CIBERSEGURIDAD_PREFIJOS:
                if codigo.startswith(prefijo):
                    motivos.append(f"cpv:{codigo}")
    return len(motivos) > 0, motivos


def guardar_en_mongo(encontradas, anio, mes, mongo_uri, mongo_db):
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
    col    = client[mongo_db]["licitaciones"]

    ops = [
        UpdateOne(
            {"_id": lic.id},
            {"$set": {
                **asdict(lic),
                "motivos_match": motivos,
                "anio":       anio,
                "mes":        mes,
                "scraped_at": datetime.utcnow(),
            }},
            upsert=True,
        )
        for lic, motivos in encontradas
    ]

    stored = 0
    if ops:
        result  = col.bulk_write(ops)
        stored  = result.upserted_count + result.modified_count

    client.close()
    return stored


def mes_anterior(hoy=None):
    hoy      = hoy or datetime.now()
    anterior = hoy.replace(day=1) - timedelta(days=1)
    return anterior.year, anterior.month


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--anio",      type=int)
    p.add_argument("--mes",       type=int)
    p.add_argument("--zip",       type=Path, help="Usar un ZIP local ya descargado")
    p.add_argument("--out-dir",   type=Path, default=Path("."))
    p.add_argument("--mongo-uri", default=os.environ.get("MONGODB_URI", "mongodb://localhost:27017/cybersec_audit"))
    p.add_argument("--mongo-db",  default=os.environ.get("MONGO_DB",    "cybersec_audit"))
    args = p.parse_args()

    if args.zip:
        ruta_zip = args.zip
        anio, mes = (args.anio, args.mes) if (args.anio and args.mes) else mes_anterior()
    else:
        anio, mes = (args.anio, args.mes) if (args.anio and args.mes) else mes_anterior()
        ruta_zip  = args.out_dir / f"licitaciones_{anio}{mes:02d}.zip"
        if not ruta_zip.exists():
            descargar_zip_mes(anio, mes, ruta_zip)
        else:
            print(f"[=] Reutilizando {ruta_zip}")

    print("[+] Procesando licitaciones...")
    encontradas, total = [], 0
    for lic in iterar_licitaciones_zip(ruta_zip):
        total += 1
        ok, motivos = es_ciberseguridad(lic)
        if ok:
            encontradas.append((lic, motivos))
        if total % 5000 == 0:
            print(f"    ... {total} procesadas, {len(encontradas)} de ciber")

    print(f"[+] Total: {total}  |  Ciberseguridad: {len(encontradas)}")

    stored = guardar_en_mongo(encontradas, anio, mes, args.mongo_uri, args.mongo_db)
    print(f"[+] MongoDB: {stored} guardadas/actualizadas")

    return 0


if __name__ == "__main__":
    sys.exit(main())
