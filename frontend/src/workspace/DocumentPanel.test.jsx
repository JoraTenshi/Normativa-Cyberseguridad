import React from 'react';
import { render, screen, within } from '@testing-library/react';
import DocumentPanel from './DocumentPanel';
import { documents, otherScopeDocuments } from './__fixtures__/documentFixtures';

const card = name => screen.getByRole('heading', { name }).closest('li');

test('distingue la guía orientativa del archivo aportado', () => {
  render(<DocumentPanel items={documents} />);
  const guide = card('Política de seguridad de la información');
  expect(within(guide).getByText('Guía orientativa')).toBeInTheDocument();
  expect(within(guide).getByText(/todavía no es un archivo aportado/)).toBeInTheDocument();

  const file = card('inventario-activos.xlsx');
  expect(within(file).getByText('Archivo aportado')).toBeInTheDocument();
  expect(within(file).queryByText(/Esto es una guía/)).not.toBeInTheDocument();
});

test('una guía no muestra fecha de aportación ni estado de revisión', () => {
  render(<DocumentPanel items={documents} />);
  const guide = card('Política de seguridad de la información');
  expect(within(guide).queryByText(/Aportado el|Fecha de aportación/)).not.toBeInTheDocument();
  expect(within(guide).queryByText(/revisión/i)).not.toBeInTheDocument();
});

test('un archivo muestra cuándo se aportó y su revisión con fecha', () => {
  render(<DocumentPanel items={documents} />);
  const file = card('inventario-activos.xlsx');
  expect(within(file).getByText(/Aportado el 3 oct\.? 2026/)).toBeInTheDocument();
  expect(within(file).getByText('Revisión realizada')).toBeInTheDocument();
  expect(within(file).getByText(/Revisado el 5 oct\.? 2026/)).toBeInTheDocument();
});

test('sin fecha de aportación lo indica y no inventa nada', () => {
  render(<DocumentPanel items={documents} />);
  const file = card('contrato-proveedor.pdf');
  expect(within(file).getByText('Fecha de aportación no disponible')).toBeInTheDocument();
  expect(within(file).getByText('Pendiente de revisión')).toBeInTheDocument();
  expect(within(file).getByText('Para qué sirve: Sin descripción')).toBeInTheDocument();
  expect(within(file).getByText('Relacionado con: Sin relación indicada')).toBeInTheDocument();
});

test('muestra para qué sirve, con qué se relaciona y quién lo aporta', () => {
  render(<DocumentPanel items={documents} />);
  const file = card('inventario-activos.xlsx');
  expect(within(file).getByText('Para qué sirve: Lista de activos del alcance.')).toBeInTheDocument();
  expect(within(file).getByText('Relacionado con: Tarea: Inventariar activos')).toBeInTheDocument();
  expect(within(file).getByText('Lo aporta: Ana (ensayo)')).toBeInTheDocument();

  const guide = card('Política de seguridad de la información');
  expect(within(guide).getByText('Relacionado con: Requisito: Requisito legal de ejemplo')).toBeInTheDocument();
});

test('un tipo o un estado desconocidos se muestran como tales', () => {
  const items = [
    { id: 'x', name: 'Raro', kind: 'inventado' },
    { id: 'y', name: 'Otro', kind: 'file', reviewStatus: 'raro' },
  ];
  render(<DocumentPanel items={items} />);
  expect(within(card('Raro')).getByText('Tipo sin clasificar')).toBeInTheDocument();
  expect(within(card('Otro')).getByText('Estado de revisión desconocido')).toBeInTheDocument();
});

test('sin documentos muestra un aviso', () => {
  render(<DocumentPanel items={[]} />);
  expect(screen.getByRole('status')).toHaveTextContent('No hay documentación para este alcance todavía.');
});

test('un error sustituye a la lista', () => {
  render(<DocumentPanel items={documents} error="No se pudo cargar la documentación." />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la documentación.');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('una denegación de acceso limpia el detalle y no se presenta como error del documento', () => {
  render(<DocumentPanel items={documents} accessDenied />);
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('No tienes acceso a los documentos de este alcance.');
  expect(alert.textContent).not.toMatch(/error|no se pudo/i);
  expect(screen.queryByText('inventario-activos.xlsx')).not.toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('la denegación de acceso prevalece sobre un error', () => {
  render(<DocumentPanel items={[]} error="Fallo técnico" accessDenied />);
  expect(screen.getByRole('alert')).toHaveTextContent('No tienes acceso');
  expect(screen.queryByText('Fallo técnico')).not.toBeInTheDocument();
});

test('al cambiar de alcance no queda ningún documento del anterior', () => {
  const { rerender } = render(<DocumentPanel items={documents} />);
  expect(screen.getByText('inventario-activos.xlsx')).toBeInTheDocument();

  rerender(<DocumentPanel items={otherScopeDocuments} />);
  expect(screen.getByText('plan-continuidad-otro-alcance.pdf')).toBeInTheDocument();
  expect(screen.queryByText('inventario-activos.xlsx')).not.toBeInTheDocument();
  expect(screen.queryByText('contrato-proveedor.pdf')).not.toBeInTheDocument();
});

test('advierte de que aportar un archivo no valida su contenido', () => {
  render(<DocumentPanel items={documents} />);
  expect(screen.getByText(/no valida su contenido ni acredita el cumplimiento/)).toBeInTheDocument();
});

test('no presenta ninguna revisión como hecha por IA', () => {
  const { container } = render(<DocumentPanel items={documents} />);
  expect(container.textContent).not.toMatch(/\bIA\b|inteligencia artificial/i);
});
