import {
  DEFAULT_FILTERS, NO_OWNER, ownerOptions, selectTasks, statusLabel,
} from './taskSelectors';
import { tasks } from './__fixtures__/workspaceFixtures';

const ids = list => list.map(task => task.id);

describe('selectTasks', () => {
  test('sin filtros excluye las archivadas y ordena por fecha prevista con las sin fecha al final', () => {
    expect(ids(selectTasks(tasks, DEFAULT_FILTERS))).toEqual(['t2', 't1', 't3', 't4']);
  });

  test('usa los filtros por defecto si no se pasan', () => {
    expect(ids(selectTasks(tasks))).toEqual(['t2', 't1', 't3', 't4']);
  });

  test('busca en el título sin distinguir mayúsculas y recorta espacios', () => {
    expect(ids(selectTasks(tasks, { text: '  INVENTARIAR ' }))).toEqual(['t3']);
  });

  test('filtra por estado', () => {
    expect(ids(selectTasks(tasks, { status: 'pendiente' }))).toEqual(['t1', 't4']);
    expect(ids(selectTasks(tasks, { status: 'terminada' }))).toEqual(['t3']);
  });

  test('filtra por responsable y por sin responsable', () => {
    expect(ids(selectTasks(tasks, { owner: 'Ana (ensayo)' }))).toEqual(['t1', 't3']);
    expect(ids(selectTasks(tasks, { owner: NO_OWNER }))).toEqual(['t4']);
  });

  test('combina filtros', () => {
    expect(ids(selectTasks(tasks, { owner: 'Ana (ensayo)', status: 'pendiente' }))).toEqual(['t1']);
    expect(selectTasks(tasks, { text: 'zzz' })).toEqual([]);
  });

  test('una fecha inválida se trata como desconocida, no como hoy', () => {
    const list = [
      { id: 'b', title: 'B', dueDate: 'no es fecha' },
      { id: 'a', title: 'A', dueDate: '2030-01-01' },
    ];
    expect(ids(selectTasks(list))).toEqual(['a', 'b']);
  });

  test('a igual fecha desempata por id y no modifica la lista original', () => {
    const list = [
      { id: 'z', title: 'Z', dueDate: '2026-12-01' },
      { id: 'a', title: 'A', dueDate: '2026-12-01' },
    ];
    const copy = [...list];
    expect(ids(selectTasks(list))).toEqual(['a', 'z']);
    expect(list).toEqual(copy);
  });
});

describe('ownerOptions', () => {
  test('devuelve responsables distintos, sin vacíos y ordenados', () => {
    const list = [
      { owner: 'Luis' }, { owner: 'Ana' }, { owner: ' Ana ' }, { owner: '' }, { owner: null }, {},
    ];
    expect(ownerOptions(list)).toEqual(['Ana', 'Luis']);
  });
});

describe('statusLabel', () => {
  test('traduce los estados conocidos y no adivina los desconocidos', () => {
    expect(statusLabel('en_curso')).toBe('En curso');
    expect(statusLabel('otro')).toBe('Estado no reconocido');
    expect(statusLabel(undefined)).toBe('Estado no reconocido');
  });
});
