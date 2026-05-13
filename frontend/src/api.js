const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost/api';

export async function listarNormativas() {
  const res = await fetch(`${BASE_URL}/normativas`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function obtenerPreguntas(id) {
  const res = await fetch(`${BASE_URL}/normativas/${id}/preguntas`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function evaluar(normativaId, respuestas) {
  const res = await fetch(`${BASE_URL}/cuestionario/evaluar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ normativa_id: normativaId, respuestas }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}
