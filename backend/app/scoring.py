from .models import RespuestaPregunta, NivelCumplimiento, RemediacionItem, Normativa

VALOR_PESO = {"si": 1.0, "parcialmente": 0.5, "no": 0.0}

UMBRALES = {
    NivelCumplimiento.ALTO: 80.0,
    NivelCumplimiento.MEDIO: 50.0,
}


def calcular_nivel(puntuacion: float) -> NivelCumplimiento:
    if puntuacion >= UMBRALES[NivelCumplimiento.ALTO]:
        return NivelCumplimiento.ALTO
    if puntuacion >= UMBRALES[NivelCumplimiento.MEDIO]:
        return NivelCumplimiento.MEDIO
    return NivelCumplimiento.BAJO


def evaluar(
    normativa: Normativa,
    respuestas: list[RespuestaPregunta],
) -> tuple[float, NivelCumplimiento, list[RemediacionItem]]:
    preguntas_index: dict[str, dict] = {}
    for bloque in normativa.bloques:
        for pregunta in bloque.preguntas:
            preguntas_index[pregunta.id] = pregunta.model_dump()

    suma_ponderada = 0.0
    suma_pesos = 0.0
    remediaciones: list[RemediacionItem] = []

    for respuesta in respuestas:
        pregunta = preguntas_index.get(respuesta.pregunta_id)
        if pregunta is None:
            continue

        peso = pregunta["peso"]
        factor = VALOR_PESO.get(respuesta.valor, 0.0)

        suma_ponderada += peso * factor
        suma_pesos += peso

        if respuesta.valor != "si":
            remediaciones.append(
                RemediacionItem(
                    pregunta_id=pregunta["id"],
                    pregunta=pregunta["pregunta"],
                    valor=respuesta.valor,
                    remediacion=pregunta["remediacion"],
                    peso=peso,
                    referencia=pregunta["referencia"],
                )
            )

    puntuacion = (suma_ponderada / suma_pesos * 100) if suma_pesos > 0 else 0.0
    puntuacion = round(puntuacion, 2)

    remediaciones.sort(key=lambda r: r.peso, reverse=True)

    return puntuacion, calcular_nivel(puntuacion), remediaciones
