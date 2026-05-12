import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import Normativa, ResultadoEvaluacion, SolicitudEvaluacion
from .scoring import evaluar

app = FastAPI(
    title="NormativaCheck API",
    description="Motor de evaluación de cumplimiento normativo de ciberseguridad",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).parent / "data" / "normativas.json"


def _cargar_normativas() -> dict[str, Normativa]:
    with open(DATA_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {item["id"]: Normativa(**item) for item in raw}


_normativas: dict[str, Normativa] = _cargar_normativas()


@app.get("/api/health")
def health():
    return {"status": "ok", "normativas_cargadas": len(_normativas)}


@app.get("/api/normativas")
def listar_normativas():
    return [
        {
            "id": n.id,
            "nombre": n.nombre,
            "descripcion": n.descripcion,
            "version": n.version,
            "total_preguntas": sum(len(b.preguntas) for b in n.bloques),
        }
        for n in _normativas.values()
    ]


@app.get("/api/normativas/{normativa_id}/preguntas")
def obtener_preguntas(normativa_id: str):
    normativa = _normativas.get(normativa_id)
    if not normativa:
        raise HTTPException(status_code=404, detail=f"Normativa '{normativa_id}' no encontrada")

    return {
        "normativa_id": normativa.id,
        "nombre": normativa.nombre,
        "bloques": [
            {
                "id": bloque.id,
                "nombre": bloque.nombre,
                "preguntas": [p.model_dump() for p in bloque.preguntas],
            }
            for bloque in normativa.bloques
        ],
    }


@app.post("/api/cuestionario/evaluar", response_model=ResultadoEvaluacion)
def evaluar_cuestionario(solicitud: SolicitudEvaluacion):
    normativa = _normativas.get(solicitud.normativa_id)
    if not normativa:
        raise HTTPException(
            status_code=404,
            detail=f"Normativa '{solicitud.normativa_id}' no encontrada",
        )

    if not solicitud.respuestas:
        raise HTTPException(status_code=422, detail="Se requiere al menos una respuesta")

    puntuacion, nivel, remediaciones = evaluar(normativa, solicitud.respuestas)

    return ResultadoEvaluacion(
        normativa_id=normativa.id,
        puntuacion=puntuacion,
        nivel_cumplimiento=nivel,
        preguntas_evaluadas=len(solicitud.respuestas),
        remediaciones=remediaciones,
    )
