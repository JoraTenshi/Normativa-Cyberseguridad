import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkspacePage from './WorkspacePage';
import { getHistorial } from '../../services/api';

jest.mock('../../services/api', () => ({
  getHistorial: jest.fn(),
}));

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);

const rows = [
  { id: ID_A, normativa_nombre: 'ENS', algoritmo_version: '2', porcentaje: 48,
    sin_base_evaluable: false, createdAt: '2026-10-06T10:00:00Z' },
  { id: ID_B, normativa_nombre: 'ISO 27001', algoritmo_version: '1', porcentaje: 70,
    sin_base_evaluable: false, createdAt: '2026-10-01T10:00:00Z' },
];

const renderPage = () => render(
  <MemoryRouter>
    <WorkspacePage />
  </MemoryRouter>
);

beforeEach(() => {
  getHistorial.mockReset();
});

test('muestra el estado de carga y después las evaluaciones con enlace al detalle', async () => {
  getHistorial.mockResolvedValue(rows);
  renderPage();
  expect(screen.getByText('Cargando...')).toBeInTheDocument();
  const link = await screen.findByRole('link', { name: 'ENS' });
  expect(link).toHaveAttribute('href', `/historial/${ID_A}`);
  expect(screen.getByText('2 de 2 evaluaciones')).toBeInTheDocument();
});

test('distingue el vacío de la cuenta sin evaluaciones', async () => {
  getHistorial.mockResolvedValue([]);
  renderPage();
  expect(await screen.findByText('Aún no tienes evaluaciones guardadas.')).toBeInTheDocument();
});

test('filtra por texto y distingue el vacío por filtros', async () => {
  getHistorial.mockResolvedValue(rows);
  renderPage();
  await screen.findByRole('link', { name: 'ENS' });

  fireEvent.change(screen.getByLabelText(/Buscar normativa/), { target: { value: 'iso' } });
  expect(screen.getByText('1 de 2 evaluaciones')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'ENS' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/Buscar normativa/), { target: { value: 'zzz' } });
  expect(screen.getByText('No hay resultados para estos filtros.')).toBeInTheDocument();
});

test('filtra por fórmula', async () => {
  getHistorial.mockResolvedValue(rows);
  renderPage();
  await screen.findByRole('link', { name: 'ENS' });

  fireEvent.change(screen.getByLabelText(/Fórmula de la evaluación/), { target: { value: '2' } });
  expect(screen.getByRole('link', { name: 'ENS' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'ISO 27001' })).not.toBeInTheDocument();
});

test('muestra un error sin datos de ejemplo y permite reintentar', async () => {
  getHistorial.mockRejectedValueOnce(new Error('fallo'));
  getHistorial.mockResolvedValueOnce(rows);
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el historial');
  expect(screen.queryByRole('link', { name: 'ENS' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('link', { name: 'ENS' })).toBeInTheDocument();
  expect(getHistorial).toHaveBeenCalledTimes(2);
});

test('un DTO inesperado termina en el aviso de error', async () => {
  getHistorial.mockResolvedValue({ ok: true, data: [] });
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
