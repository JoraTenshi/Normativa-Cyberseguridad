import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import WorkspacePage from './WorkspacePage';
import { getHistorial } from '../services/api';

jest.mock('../services/api', () => ({ getHistorial: jest.fn() }));

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);
const rows = [
  { id: ID_A, normativa_nombre: 'ENS', algoritmo_version: '2', porcentaje: 48,
    sin_base_evaluable: false, createdAt: '2026-10-06T10:00:00Z' },
  { id: ID_B, normativa_nombre: 'ISO 27001', algoritmo_version: '1', porcentaje: 70,
    sin_base_evaluable: false, createdAt: '2026-10-01T10:00:00Z' },
];

let container;
let root;
const link = name => Array.from(container.querySelectorAll('a')).find(a => a.textContent === name);
const renderPage = () => root.render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <WorkspacePage />
  </MemoryRouter>
);

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  getHistorial.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('muestra el estado de carga y después las evaluaciones con enlace al detalle', async () => {
  let complete;
  getHistorial.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  act(renderPage);
  expect(container.textContent).toContain('Cargando...');
  await act(async () => { complete(rows); });
  expect(link('ENS').getAttribute('href')).toBe('/historial/' + ID_A);
  expect(container.textContent).toContain('2 de 2 evaluaciones');
});

test('distingue el vacío de la cuenta sin evaluaciones', async () => {
  getHistorial.mockResolvedValue([]);
  await act(async () => renderPage());
  expect(container.textContent).toContain('Aún no tienes evaluaciones guardadas.');
});

test('filtra por texto y distingue el vacío por filtros', async () => {
  getHistorial.mockResolvedValue(rows);
  await act(async () => renderPage());
  const search = container.querySelector('input[type="search"]');
  act(() => Simulate.change(search, { target: { value: 'iso' } }));
  expect(container.textContent).toContain('1 de 2 evaluaciones');
  expect(link('ENS')).toBeUndefined();
  act(() => Simulate.change(search, { target: { value: 'zzz' } }));
  expect(container.textContent).toContain('No hay resultados para estos filtros.');
});

test('filtra por fórmula', async () => {
  getHistorial.mockResolvedValue(rows);
  await act(async () => renderPage());
  act(() => Simulate.change(container.querySelector('select'), { target: { value: '2' } }));
  expect(link('ENS')).toBeDefined();
  expect(link('ISO 27001')).toBeUndefined();
});

test('muestra un error sin datos de ejemplo y permite reintentar', async () => {
  getHistorial.mockRejectedValueOnce(new Error('fallo')).mockResolvedValueOnce(rows);
  await act(async () => renderPage());
  expect(container.querySelector('[role="alert"]').textContent).toContain('No se pudo cargar el historial');
  expect(link('ENS')).toBeUndefined();
  const retry = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Reintentar');
  await act(async () => { retry.click(); });
  expect(link('ENS')).toBeDefined();
  expect(getHistorial).toHaveBeenCalledTimes(2);
});

test('un DTO inesperado termina en el aviso de error', async () => {
  getHistorial.mockResolvedValue({ ok: true, data: [] });
  await act(async () => renderPage());
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
