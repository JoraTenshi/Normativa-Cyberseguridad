import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScopeSelector from './ScopeSelector';
import { scopes } from './__fixtures__/workspaceFixtures';

test('muestra las opciones como grupo de radios y el contexto del alcance elegido', () => {
  render(<ScopeSelector options={scopes} selectedId="scope-a" onChange={() => {}} />);
  expect(screen.getByRole('group', { name: /Elige el alcance/ })).toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.getByRole('radio', { name: /Plataforma SaaS/ })).toBeChecked();
  expect(screen.getByText(/Contexto actual/)).toHaveTextContent('Plataforma SaaS (ensayo)');
  expect(screen.getByText('Servicio de ejemplo usado en pruebas.')).toBeInTheDocument();
});

test('al elegir otro alcance avisa con su id y no guarda nada por su cuenta', () => {
  const onChange = jest.fn();
  render(<ScopeSelector options={scopes} selectedId="scope-a" onChange={onChange} />);
  fireEvent.click(screen.getByRole('radio', { name: /Consultoría/ }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('scope-b');
  expect(screen.getByRole('radio', { name: /Plataforma SaaS/ })).toBeChecked();
});

test('el contexto cambia cuando el contenedor cambia la selección', () => {
  const { rerender } = render(<ScopeSelector options={scopes} selectedId="scope-a" />);
  rerender(<ScopeSelector options={scopes} selectedId="scope-b" />);
  expect(screen.getByText(/Contexto actual/)).toHaveTextContent('Consultoría de seguridad (ensayo)');
});

test('sin alcances muestra un aviso y ningún radio', () => {
  render(<ScopeSelector options={[]} selectedId={null} />);
  expect(screen.getByRole('status')).toHaveTextContent('No hay alcances definidos todavía.');
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});

test('sin selección lo indica', () => {
  render(<ScopeSelector options={scopes} selectedId={null} />);
  expect(screen.getByText('Ningún alcance seleccionado.')).toBeInTheDocument();
  screen.getAllByRole('radio').forEach(radio => expect(radio).not.toBeChecked());
});

test('una selección inexistente avisa y no marca ninguna opción', () => {
  render(<ScopeSelector options={scopes} selectedId="borrado" />);
  expect(screen.getByRole('alert')).toHaveTextContent('ya no está disponible');
  screen.getAllByRole('radio').forEach(radio => expect(radio).not.toBeChecked());
  expect(screen.queryByText(/Contexto actual/)).not.toBeInTheDocument();
});

test('un alcance restringido queda deshabilitado, etiquetado y no avisa al hacer clic', () => {
  const onChange = jest.fn();
  render(<ScopeSelector options={scopes} selectedId="scope-a" onChange={onChange} />);
  const restricted = screen.getByRole('radio', { name: /Producto restringido/ });
  expect(restricted).toBeDisabled();
  expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  fireEvent.click(restricted);
  expect(onChange).not.toHaveBeenCalled();
});

test('si el alcance seleccionado es restringido no muestra su contexto', () => {
  render(<ScopeSelector options={scopes} selectedId="scope-c" />);
  expect(screen.getByRole('alert')).toHaveTextContent('No tienes acceso');
  expect(screen.queryByText('No debe mostrarse.')).not.toBeInTheDocument();
});

test('un error sustituye a la lista', () => {
  render(<ScopeSelector options={scopes} selectedId="scope-a" error="No se pudieron cargar los alcances." />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los alcances.');
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});
