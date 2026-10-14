import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskDetail from './TaskDetail';
import { tasks } from './__fixtures__/workspaceFixtures';

const byId = id => tasks.find(task => task.id === id);

test('sin tarea invita a seleccionar una', () => {
  render(<TaskDetail task={null} />);
  expect(screen.getByRole('status')).toHaveTextContent('Selecciona una tarea para ver su detalle.');
});

test('muestra contexto, motivo, referencias y documentación con su advertencia', () => {
  render(<TaskDetail task={byId('t1')} />);
  expect(screen.getByRole('heading', { name: 'Redactar política de ejemplo' })).toBeInTheDocument();
  expect(screen.getByText('Plataforma SaaS (ensayo)')).toBeInTheDocument();
  expect(screen.getByText('Falta una política escrita.')).toBeInTheDocument();
  expect(screen.getByText(/Requisito legal de ejemplo · Norma de ejemplo, art\. 1/)).toBeInTheDocument();
  expect(screen.getByText('borrador-politica.pdf')).toBeInTheDocument();
  expect(screen.getByText(/no prueba su contenido ni el cumplimiento/)).toBeInTheDocument();
});

test('indica lo que falta en vez de inventarlo', () => {
  render(<TaskDetail task={byId('t2')} />);
  expect(screen.getByText('Sin contexto indicado')).toBeInTheDocument();
  expect(screen.getByText('Sin motivo indicado')).toBeInTheDocument();
  expect(screen.getByText('Sin referencias indicadas')).toBeInTheDocument();
  expect(screen.getByText('Sin documentación relacionada')).toBeInTheDocument();
});

test('Guardar está deshabilitado hasta que hay cambios y avisa con los campos editados', () => {
  const onSave = jest.fn();
  render(<TaskDetail task={byId('t2')} onSave={onSave} />);
  const save = screen.getByRole('button', { name: 'Guardar cambios' });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Respuesta recibida.' } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledWith(
    't2',
    { owner: 'Luis (ensayo)', dueDate: '2026-11-05', notes: 'Respuesta recibida.' },
    'save'
  );
});

test('vaciar responsable y fecha se envía como null', () => {
  const onSave = jest.fn();
  render(<TaskDetail task={byId('t2')} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText('Responsable'), { target: { value: '  ' } });
  fireEvent.change(screen.getByLabelText('Fecha prevista'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(onSave).toHaveBeenCalledWith('t2', { owner: null, dueDate: null, notes: 'Pendiente de respuesta.' }, 'save');
});

test('Finalizar solo aparece en tareas abiertas y conserva el borrador', () => {
  const onSave = jest.fn();
  render(<TaskDetail task={byId('t1')} onSave={onSave} />);
  expect(screen.queryByRole('button', { name: 'Archivar tarea' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reabrir tarea' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Lista.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar tarea' }));
  expect(onSave).toHaveBeenCalledWith(
    't1',
    { owner: 'Ana (ensayo)', dueDate: '2026-11-20', notes: 'Lista.' },
    'finish'
  );
});

test('una tarea terminada ofrece Reabrir y Archivar, no Finalizar', () => {
  const onSave = jest.fn();
  const onArchive = jest.fn();
  render(<TaskDetail task={byId('t3')} onSave={onSave} onArchive={onArchive} />);
  expect(screen.queryByRole('button', { name: 'Finalizar tarea' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Archivar tarea' }));
  expect(onArchive).toHaveBeenCalledWith('t3');

  fireEvent.click(screen.getByRole('button', { name: 'Reabrir tarea' }));
  expect(onSave).toHaveBeenCalledWith('t3', expect.any(Object), 'reopen');
  expect(onSave.mock.calls[0][1]).not.toHaveProperty('status');
});

test('no afirma que terminada equivalga a cumplimiento', () => {
  render(<TaskDetail task={byId('t3')} />);
  expect(screen.getByText(/no acredita por sí sola el cumplimiento/)).toBeInTheDocument();
  expect(screen.getByText(/no la borra/)).toBeInTheDocument();
});

test('mientras se guarda deshabilita botones y campos y lo anuncia', () => {
  render(<TaskDetail task={byId('t3')} saving onSave={() => {}} onArchive={() => {}} />);
  expect(screen.getByRole('status')).toHaveTextContent('Guardando...');
  ['Guardar cambios', 'Reabrir tarea', 'Archivar tarea'].forEach(name =>
    expect(screen.getByRole('button', { name })).toBeDisabled());
  expect(screen.getByLabelText('Notas')).toBeDisabled();
});

test('un error se muestra sin perder el borrador', () => {
  const task = byId('t2');
  const { rerender } = render(<TaskDetail task={task} />);
  fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Texto sin guardar' } });

  rerender(<TaskDetail task={{ ...task }} error="No se pudo guardar. Inténtalo de nuevo." />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar');
  expect(screen.getByLabelText('Notas')).toHaveValue('Texto sin guardar');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
});

test('el borrador se reinicia con una versión nueva del servidor o con otra tarea', () => {
  const task = byId('t2');
  const { rerender } = render(<TaskDetail task={task} />);
  fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Borrador' } });

  rerender(<TaskDetail task={{ ...task, notes: 'Versión del servidor', updatedAt: '2026-10-09T10:00:00Z' }} />);
  expect(screen.getByLabelText('Notas')).toHaveValue('Versión del servidor');

  rerender(<TaskDetail task={byId('t1')} />);
  expect(screen.getByLabelText('Responsable')).toHaveValue('Ana (ensayo)');
});

test('una tarea archivada es de solo lectura', () => {
  render(<TaskDetail task={byId('t5')} />);
  expect(screen.getByRole('status')).toHaveTextContent('Tarea archivada. Ya no aparece en la lista activa.');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Notas')).not.toBeInTheDocument();
});

test('un estado desconocido no ofrece acciones de estado', () => {
  const task = { id: 'x', title: 'Rara', status: 'inventado' };
  render(<TaskDetail task={task} />);
  expect(screen.getByText('Estado no reconocido', { selector: 'span' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Finalizar tarea' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reabrir tarea' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Archivar tarea' })).not.toBeInTheDocument();
});
