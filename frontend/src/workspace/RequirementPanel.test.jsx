import React from 'react';
import { render, screen, within } from '@testing-library/react';
import RequirementPanel from './RequirementPanel';
import { requirements } from './__fixtures__/workspaceFixtures';

test('distingue obligación legal, requisito contractual y estándar voluntario', () => {
  render(<RequirementPanel items={requirements} />);
  expect(screen.getByText('Obligación legal')).toBeInTheDocument();
  expect(screen.getByText('Requisito contractual')).toBeInTheDocument();
  expect(screen.getByText('Estándar voluntario')).toBeInTheDocument();
  expect(screen.getByText('Fuente: Norma de ejemplo, art. 1')).toBeInTheDocument();
});

test('muestra qué falta por confirmar solo donde hay puntos pendientes', () => {
  render(<RequirementPanel items={requirements} />);
  expect(screen.getAllByText('Falta por confirmar')).toHaveLength(1);
  expect(screen.getByText('Confirmar si el servicio entra en el ámbito')).toBeInTheDocument();
  expect(screen.getByText('Identificar al responsable')).toBeInTheDocument();
});

test('diferencia pendiente, en revisión y revisión realizada con su fecha', () => {
  render(<RequirementPanel items={requirements} />);
  expect(screen.getByText('Pendiente de revisión')).toBeInTheDocument();
  expect(screen.getByText('En revisión')).toBeInTheDocument();
  expect(screen.getByText('Revisión realizada')).toBeInTheDocument();
  expect(screen.getByText(/Revisado el 2 oct\.? 2026/)).toBeInTheDocument();
});

test('una revisión realizada sin fecha lo indica en vez de inventarla', () => {
  const items = [{ id: 'x', title: 'X', origin: 'legal', reviewStatus: 'reviewed', reviewedAt: null }];
  render(<RequirementPanel items={items} />);
  expect(screen.getByText('Fecha de revisión no disponible')).toBeInTheDocument();
});

test('un origen o un estado desconocidos se muestran como tales', () => {
  const items = [{ id: 'x', title: 'X', origin: 'inventado', reviewStatus: 'raro' }];
  render(<RequirementPanel items={items} />);
  expect(screen.getByText('Origen sin clasificar')).toBeInTheDocument();
  expect(screen.getByText('Estado de revisión desconocido')).toBeInTheDocument();
  expect(screen.getByText('Fuente: Fuente sin indicar')).toBeInTheDocument();
});

test('sin requisitos muestra un aviso', () => {
  render(<RequirementPanel items={[]} />);
  expect(screen.getByRole('status')).toHaveTextContent('No hay requisitos para este alcance todavía.');
});

test('advierte de que aparecer en la lista no implica aplicabilidad jurídica', () => {
  render(<RequirementPanel items={requirements} />);
  expect(screen.getByText(/no establece por sí solo que sea jurídicamente aplicable/)).toBeInTheDocument();
});

test('no usa lenguaje de conformidad ni de certificación', () => {
  const { container } = render(<RequirementPanel items={requirements} />);
  expect(container.textContent).not.toMatch(/cumple|cumples|certificad/i);
});

test('cada requisito es un elemento de lista con su título como encabezado', () => {
  render(<RequirementPanel items={requirements} />);
  const rows = screen.getAllByRole('listitem').filter(li => within(li).queryByRole('heading', { level: 3 }));
  expect(rows).toHaveLength(3);
});
