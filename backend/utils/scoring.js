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

module.exports = { construirRemediaciones, getNivel };
