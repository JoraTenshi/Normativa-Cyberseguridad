import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listarNormativas, obtenerPreguntas, evaluar } from './api.js';

const mockFetch = (data, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });

beforeEach(() => { vi.unstubAllGlobals(); });

describe('listarNormativas', () => {
  it('llama a /normativas y devuelve los datos', async () => {
    const data = [{ id: 'ens', nombre: 'ENS' }];
    vi.stubGlobal('fetch', mockFetch(data));
    const result = await listarNormativas();
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/normativas'));
  });

  it('lanza error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));
    await expect(listarNormativas()).rejects.toThrow('Error 500');
  });
});

describe('obtenerPreguntas', () => {
  it('llama a /normativas/:id/preguntas', async () => {
    const data = { normativa_id: 'ens', bloques: [] };
    vi.stubGlobal('fetch', mockFetch(data));
    const result = await obtenerPreguntas('ens');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/normativas/ens/preguntas'));
  });
});

describe('evaluar', () => {
  it('hace POST a /cuestionario/evaluar con el cuerpo correcto', async () => {
    const resultado = { puntuacion: 75, nivel_cumplimiento: 'MEDIO', remediaciones: [] };
    vi.stubGlobal('fetch', mockFetch(resultado));
    const respuestas = [{ pregunta_id: 'p1', valor: 'si' }];
    const result = await evaluar('ens', respuestas);
    expect(result).toEqual(resultado);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/cuestionario/evaluar'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ normativa_id: 'ens', respuestas }),
      })
    );
  });

  it('lanza error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));
    await expect(evaluar('ens', [])).rejects.toThrow('Error 500');
  });
});
