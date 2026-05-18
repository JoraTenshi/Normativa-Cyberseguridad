function construirRemediaciones(normativa, respuestas) {
  const mapa = {};
  respuestas.forEach(r => { mapa[r.pregunta_id] = r.valor; });

  const items = [];
  normativa.bloques.forEach(bloque => {
    bloque.preguntas.forEach(pregunta => {
      const valor = mapa[pregunta.id] ?? 0;
      if (valor < 1) {
        const gap = pregunta.peso * (1 - valor);
        items.push({
          pregunta_id:  pregunta.id,
          bloque_id:    bloque.id,
          bloque:       bloque.nombre,
          pregunta:     pregunta.texto,
          nivel:        pregunta.nivel ?? null,
          fase_pds:     pregunta.fase_pds ?? null,
          remediacion:  pregunta.remediacion ?? null,
          valor_actual: valor,
          prioridad:    Math.round(gap * 100) / 100
        });
      }
    });
  });

  return items.sort((a, b) => b.prioridad - a.prioridad);
}

function getNivel(porcentaje) {
  if (porcentaje >= 85) return 'Alto';
  if (porcentaje >= 60) return 'Medio';
  if (porcentaje >= 30) return 'Bajo';
  return 'Crítico';
}

function calcularCoberturaEstimada(normativaActual, puntuacionesBloques, otrasNormativas) {
  const mapaBloquesActual = new Map(
    normativaActual.bloques.map(b => [b.id, b])
  );

  const perfilAcumulado = {};
  for (const pb of puntuacionesBloques) {
    const bloqueDef = mapaBloquesActual.get(pb.bloque_id);
    if (!bloqueDef || !bloqueDef.temas || bloqueDef.temas.length === 0) continue;
    for (const tema of bloqueDef.temas) {
      if (!perfilAcumulado[tema]) perfilAcumulado[tema] = { suma: 0, peso: 0 };
      perfilAcumulado[tema].suma += pb.porcentaje * pb.max_puntuacion;
      perfilAcumulado[tema].peso += pb.max_puntuacion;
    }
  }

  const perfilTematico = {};
  for (const [tema, { suma, peso }] of Object.entries(perfilAcumulado)) {
    perfilTematico[tema] = peso > 0 ? suma / peso : null;
  }

  if (Object.keys(perfilTematico).length === 0) return [];

  return otrasNormativas.map(norm => {
    const bloquesEstimados = norm.bloques.map(bloque => {
      const temasBloque = bloque.temas ?? [];
      const valores = temasBloque
        .map(t => perfilTematico[t])
        .filter(v => v !== undefined && v !== null);

      if (valores.length === 0) {
        return {
          bloque_id:           bloque.id,
          nombre:              bloque.nombre,
          porcentaje_estimado: null
        };
      }

      const media = valores.reduce((s, v) => s + v, 0) / valores.length;
      return {
        bloque_id:           bloque.id,
        nombre:              bloque.nombre,
        porcentaje_estimado: Math.round(media)
      };
    });

    let sumaPond = 0;
    let pesoTotal = 0;
    let bloquesConDato = 0;
    for (const be of bloquesEstimados) {
      if (be.porcentaje_estimado === null) continue;
      const bloqueDef = norm.bloques.find(b => b.id === be.bloque_id);
      const pesoBloque = bloqueDef.preguntas.reduce((s, p) => s + p.peso, 0);
      sumaPond += be.porcentaje_estimado * pesoBloque;
      pesoTotal += pesoBloque;
      bloquesConDato++;
    }

    const porcentajeEstimado = pesoTotal > 0 ? Math.round(sumaPond / pesoTotal) : null;
    const coberturaTematica = norm.bloques.length > 0
      ? Math.round((bloquesConDato / norm.bloques.length) * 100) / 100
      : 0;

    return {
      normativa_id:        norm.id,
      normativa_nombre:    norm.nombre,
      porcentaje_estimado: porcentajeEstimado,
      cobertura_tematica:  coberturaTematica,
      bloques_estimados:   bloquesEstimados,
      tipo:                'estimado'
    };
  });
}

module.exports = { construirRemediaciones, getNivel, calcularCoberturaEstimada };
