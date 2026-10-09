import { toEvaluations, selectEvaluations } from './historyAdapter';

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);
const ID_C = 'c'.repeat(24);

const base = {
  id: ID_A,
  normativa_nombre: 'ENS',
  algoritmo_version: '2',
  porcentaje: 48,
  sin_base_evaluable: false,
  createdAt: '2026-10-06T10:00:00Z',
};

describe('toEvaluations', () => {
  test('rechaza un contrato que no es un array', () => {
    expect(() => toEvaluations({})).toThrow();
    expect(() => toEvaluations(null)).toThrow();
  });

  test('rechaza identificadores que no son ObjectId', () => {
    expect(() => toEvaluations([{ ...base, id: 'abc' }])).toThrow();
    expect(() => toEvaluations([{ ...base, id: undefined }])).toThrow();
  });

  test('rechaza elementos nulos', () => {
    expect(() => toEvaluations([null])).toThrow();
  });

  test('rechaza identificadores duplicados', () => {
    expect(() => toEvaluations([base, { ...base }])).toThrow();
  });

  test('normaliza una evaluación v2 válida', () => {
    const row = toEvaluations([base])[0];
    expect(row.id).toBe(ID_A);
    expect(row.name).toBe('ENS');
    expect(row.version).toBe('2');
    expect(row.score).toBe(48);
    expect(row.formula).toBe('Índice de autoevaluación v2');
    expect(row.date).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });

  test('sin algoritmo_version se lee como v1', () => {
    const { algoritmo_version, ...sinVersion } = base;
    const row = toEvaluations([sinVersion])[0];
    expect(row.version).toBe('1');
    expect(row.formula).toBe('Fórmula anterior (v1)');
  });

  test('una versión desconocida no se interpreta', () => {
    const row = toEvaluations([{ ...base, algoritmo_version: '9' }])[0];
    expect(row.score).toBeNull();
    expect(row.label).toBe('Versión no compatible');
    expect(row.formula).toBe('Revisar contrato');
  });

  test('0 % es un índice válido, no ausencia', () => {
    const row = toEvaluations([{ ...base, porcentaje: 0 }])[0];
    expect(row.score).toBe(0);
    expect(row.label).toBe('0 %');
  });

  test('sin base evaluable no se convierte en cero', () => {
    const row = toEvaluations([{ ...base, sin_base_evaluable: true }])[0];
    expect(row.score).toBeNull();
    expect(row.label).toBe('Sin base evaluable');
  });

  test('porcentaje fuera de rango, texto o ausente da Sin índice', () => {
    [150, -1, '48', undefined, NaN].forEach(porcentaje => {
      const row = toEvaluations([{ ...base, porcentaje }])[0];
      expect(row.score).toBeNull();
      expect(row.label).toBe('Sin índice');
    });
  });

  test('la fecha ausente o inválida queda como null, no como hoy', () => {
    expect(toEvaluations([{ ...base, createdAt: undefined }])[0].date).toBeNull();
    expect(toEvaluations([{ ...base, createdAt: 'no es fecha' }])[0].date).toBeNull();
    expect(toEvaluations([{ ...base, createdAt: 1234 }])[0].date).toBeNull();
  });

  test('usa normativa si falta normativa_nombre y Sin nombre si faltan ambos', () => {
    expect(toEvaluations([{ ...base, normativa_nombre: undefined, normativa: 'iso27001' }])[0].name).toBe('iso27001');
    expect(toEvaluations([{ ...base, normativa_nombre: undefined }])[0].name).toBe('Sin nombre');
  });

  test('una lista vacía da una lista vacía', () => {
    expect(toEvaluations([])).toEqual([]);
  });
});

describe('selectEvaluations', () => {
  const items = toEvaluations([
    { ...base, id: ID_A, normativa_nombre: 'ENS', algoritmo_version: '2', createdAt: '2026-10-01T10:00:00Z' },
    { ...base, id: ID_B, normativa_nombre: 'ISO 27001', algoritmo_version: '1', createdAt: '2026-10-05T10:00:00Z' },
    { ...base, id: ID_C, normativa_nombre: 'ENS', algoritmo_version: '1', createdAt: undefined },
  ]);

  test('sin filtros devuelve todo, ordenado por fecha descendente y sin fecha al final', () => {
    const result = selectEvaluations(items, '', 'all');
    expect(result.map(r => r.id)).toEqual([ID_B, ID_A, ID_C]);
  });

  test('busca sin distinguir mayúsculas y recorta espacios', () => {
    const result = selectEvaluations(items, '  ens ', 'all');
    expect(result.map(r => r.id)).toEqual([ID_A, ID_C]);
  });

  test('filtra por fórmula', () => {
    expect(selectEvaluations(items, '', '1').map(r => r.id)).toEqual([ID_B, ID_C]);
    expect(selectEvaluations(items, '', '2').map(r => r.id)).toEqual([ID_A]);
  });

  test('combina búsqueda y fórmula', () => {
    expect(selectEvaluations(items, 'ens', '1').map(r => r.id)).toEqual([ID_C]);
  });

  test('sin coincidencias devuelve vacío', () => {
    expect(selectEvaluations(items, 'zzz', 'all')).toEqual([]);
  });

  test('a igual fecha desempata por id y no modifica la lista original', () => {
    const igual = toEvaluations([
      { ...base, id: ID_B, createdAt: '2026-10-06T10:00:00Z' },
      { ...base, id: ID_A, createdAt: '2026-10-06T10:00:00Z' },
    ]);
    const copia = [...igual];
    expect(selectEvaluations(igual, '', 'all').map(r => r.id)).toEqual([ID_A, ID_B]);
    expect(igual).toEqual(copia);
  });
});
