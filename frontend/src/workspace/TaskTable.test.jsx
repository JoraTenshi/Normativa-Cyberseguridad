import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TaskTable from './TaskTable';
import { DEFAULT_FILTERS, NO_OWNER } from './taskSelectors';
import { tasks } from './__fixtures__/workspaceFixtures';

const titles = () => screen.getAllByRole('rowheader').map(cell => cell.textContent);

test('muestra las columnas, las tareas activas y su orden por fecha prevista', () => {
  render(<TaskTable items={tasks} filters={DEFAULT_FILTERS} />);
  ['Tarea', 'Estado', 'Responsable', 'Fecha prevista'].forEach(name =>
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument());
  expect(titles()).toEqual([
    'Revisar contrato de proveedor',
    'Redactar política de ejemplo',
    'Inventariar activos',
    'Formar al equipo',
  ]);
  expect(screen.getByText('4 de 4 tareas')).toBeInTheDocument();
});

test('oculta las tareas archivadas', () => {
  render(<TaskTable items={tasks} filters={DEFAULT_FILTERS} />);
  expect(screen.queryByText('Tarea archivada de ensayo')).not.toBeInTheDocument();
});

test('una fecha desconocida y un responsable ausente se indican sin rellenarlos', () => {
  render(<TaskTable items={tasks} filters={DEFAULT_FILTERS} />);
  expect(screen.getAllByText('Sin fecha prevista')).toHaveLength(2);
  expect(screen.getByText('Sin responsable', { selector: 'td' })).toBeInTheDocument();
  const row = screen.getByRole('row', { name: /Revisar contrato/ });
  expect(within(row).getByText(/5 nov\.? 2026/)).toBeInTheDocument();
});

test('al pulsar el título avisa con el id de la tarea y marca la seleccionada', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <TaskTable items={tasks} filters={DEFAULT_FILTERS} onSelect={onSelect} selectedId={null} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Inventariar activos' }));
  expect(onSelect).toHaveBeenCalledWith('t3');
  rerender(<TaskTable items={tasks} filters={DEFAULT_FILTERS} onSelect={onSelect} selectedId="t3" />);
  expect(screen.getByRole('button', { name: 'Inventariar activos' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: 'Formar al equipo' })).not.toHaveAttribute('aria-current');
});

test('los filtros avisan siempre con el objeto completo', () => {
  const onFilterChange = jest.fn();
  render(<TaskTable items={tasks} filters={DEFAULT_FILTERS} onFilterChange={onFilterChange} />);

  fireEvent.change(screen.getByLabelText('Buscar tarea'), { target: { value: 'inv' } });
  expect(onFilterChange).toHaveBeenLastCalledWith({ text: 'inv', status: 'all', owner: 'all' });

  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'terminada' } });
  expect(onFilterChange).toHaveBeenLastCalledWith({ text: '', status: 'terminada', owner: 'all' });

  fireEvent.change(screen.getByLabelText('Responsable'), { target: { value: NO_OWNER } });
  expect(onFilterChange).toHaveBeenLastCalledWith({ text: '', status: 'all', owner: NO_OWNER });
});

test('aplica los filtros recibidos por props y ajusta el recuento', () => {
  render(<TaskTable items={tasks} filters={{ ...DEFAULT_FILTERS, text: 'inventariar' }} />);
  expect(titles()).toEqual(['Inventariar activos']);
  expect(screen.getByText('1 de 4 tareas')).toBeInTheDocument();
});

test('los responsables del desplegable salen de las tareas activas', () => {
  render(<TaskTable items={tasks} filters={DEFAULT_FILTERS} />);
  const options = within(screen.getByLabelText('Responsable')).getAllByRole('option').map(o => o.textContent);
  expect(options).toEqual([
    'Todos los responsables', 'Sin responsable', 'Ana (ensayo)', 'Luis (ensayo)',
  ]);
});

test('distingue "no hay tareas" de "ninguna coincide con los filtros"', () => {
  const { rerender } = render(<TaskTable items={[]} filters={DEFAULT_FILTERS} />);
  expect(screen.getByRole('status')).toHaveTextContent('Todavía no hay tareas en este alcance.');
  expect(screen.queryByLabelText('Buscar tarea')).not.toBeInTheDocument();

  rerender(<TaskTable items={tasks} filters={{ ...DEFAULT_FILTERS, text: 'zzz' }} />);
  expect(screen.getByText('No hay tareas para estos filtros.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('un estado desconocido se muestra como tal', () => {
  const items = [{ id: 'x', title: 'Rara', status: 'inventado' }];
  render(<TaskTable items={items} filters={DEFAULT_FILTERS} />);
  expect(screen.getByText('Estado no reconocido')).toBeInTheDocument();
});
