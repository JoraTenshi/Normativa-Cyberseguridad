from pydantic import BaseModel, Field
from typing import Literal
from enum import Enum


class NivelCumplimiento(str, Enum):
    ALTO = "ALTO"
    MEDIO = "MEDIO"
    BAJO = "BAJO"


class Pregunta(BaseModel):
    id: str
    pregunta: str
    peso: int = Field(ge=1, le=10)
    remediacion: str
    tipo: str
    nivel: str
    referencia: str


class Bloque(BaseModel):
    id: str
    nombre: str
    preguntas: list[Pregunta]


class Normativa(BaseModel):
    id: str
    nombre: str
    descripcion: str
    version: str
    bloques: list[Bloque]


class RespuestaPregunta(BaseModel):
    pregunta_id: str
    valor: Literal["si", "no", "parcialmente"]


class SolicitudEvaluacion(BaseModel):
    normativa_id: str
    respuestas: list[RespuestaPregunta]


class RemediacionItem(BaseModel):
    pregunta_id: str
    pregunta: str
    valor: str
    remediacion: str
    peso: int
    referencia: str


class ResultadoEvaluacion(BaseModel):
    normativa_id: str
    puntuacion: float = Field(description="Puntuación ponderada de 0 a 100")
    nivel_cumplimiento: NivelCumplimiento
    preguntas_evaluadas: int
    remediaciones: list[RemediacionItem]
