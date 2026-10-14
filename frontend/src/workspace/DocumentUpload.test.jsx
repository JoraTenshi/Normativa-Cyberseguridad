import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentUpload from './DocumentUpload';

const pdf = () => new File(['contenido'], 'plan.pdf', { type: 'application/pdf' });

afterEach(() => {
  jest.restoreAllMocks();
});

test('por defecto no está disponible y no ofrece ningún control', () => {
  render(<DocumentUpload />);
  expect(screen.getByRole('status')).toHaveTextContent('La subida de archivos todavía no está disponible.');
  expect(screen.queryByLabelText('Elegir archivo')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('aunque se pasen datos y callbacks, sin available no ofrece nada', () => {
  render(<DocumentUpload status="selected" fileName="plan.pdf" onUpload={() => {}} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText('plan.pdf')).not.toBeInTheDocument();
});

test('disponible y sin archivo: permite elegir y avisa con el archivo elegido', () => {
  const onSelect = jest.fn();
  render(<DocumentUpload available onSelect={onSelect} accept=".pdf" />);
  const input = screen.getByLabelText('Elegir archivo');
  expect(input).toHaveAttribute('type', 'file');
  expect(input).toHaveAttribute('accept', '.pdf');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();

  const file = pdf();
  fireEvent.change(input, { target: { files: [file] } });
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith(file);
});

test('avisa con null si no se elige ningún archivo', () => {
  const onSelect = jest.fn();
  render(<DocumentUpload available onSelect={onSelect} />);
  fireEvent.change(screen.getByLabelText('Elegir archivo'), { target: { files: [] } });
  expect(onSelect).toHaveBeenCalledWith(null);
});

test('con archivo elegido muestra nombre y tamaño y ofrece Subir y Quitar', () => {
  const onUpload = jest.fn();
  const onCancel = jest.fn();
  render(
    <DocumentUpload available status="selected" fileName="plan.pdf" fileSize={1536}
      onUpload={onUpload} onCancel={onCancel} />
  );
  expect(screen.getByText('plan.pdf')).toBeInTheDocument();
  expect(screen.getByText(/1,5 KB/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));
  expect(onUpload).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('formatea bytes, KB y MB', () => {
  const { rerender } = render(<DocumentUpload available status="selected" fileName="a" fileSize={500} />);
  expect(screen.getByText(/500 B/)).toBeInTheDocument();
  rerender(<DocumentUpload available status="selected" fileName="a" fileSize={5 * 1024 * 1024} />);
  expect(screen.getByText(/5 MB/)).toBeInTheDocument();
  rerender(<DocumentUpload available status="selected" fileName="a" fileSize={null} />);
  expect(screen.queryByText(/\(.*\)/)).not.toBeInTheDocument();
});

test('mientras sube anuncia el estado y bloquea la entrada y los botones', () => {
  render(<DocumentUpload available status="uploading" fileName="plan.pdf" onUpload={() => {}} />);
  expect(screen.getByRole('status')).toHaveTextContent('Subiendo archivo...');
  expect(screen.getByLabelText('Elegir archivo')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Subir archivo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Quitar selección' })).toBeDisabled();
});

test('un rechazo explica el motivo, pide otro archivo y no ofrece reintentar el mismo', () => {
  render(
    <DocumentUpload available status="rejected" fileName="plan.exe"
      message="El tipo de archivo no está admitido." />
  );
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('El archivo no se ha aceptado.');
  expect(alert).toHaveTextContent('El tipo de archivo no está admitido.');
  expect(alert).toHaveTextContent('Elige otro archivo.');
  expect(screen.queryByRole('button', { name: 'Subir archivo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reintentar subida' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Quitar selección' })).toBeInTheDocument();
});

test('un rechazo sin motivo usa un texto genérico', () => {
  render(<DocumentUpload available status="rejected" fileName="plan.exe" />);
  expect(screen.getByRole('alert')).toHaveTextContent('El servidor ha rechazado el archivo.');
});

test('un error técnico se distingue del rechazo y permite reintentar', () => {
  const onUpload = jest.fn();
  render(<DocumentUpload available status="error" fileName="plan.pdf" onUpload={onUpload} />);
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent('No se pudo subir el archivo. Inténtalo de nuevo.');
  expect(alert.textContent).not.toMatch(/no se ha aceptado/);

  fireEvent.click(screen.getByRole('button', { name: 'Reintentar subida' }));
  expect(onUpload).toHaveBeenCalledTimes(1);
});

test('el éxito aclara que subir no valida el contenido', () => {
  render(<DocumentUpload available status="success" />);
  expect(screen.getByRole('status')).toHaveTextContent('Archivo subido.');
  expect(screen.getByRole('status')).toHaveTextContent('no valida su contenido');
  expect(screen.getByRole('status')).toHaveTextContent('pendiente de revisión');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('nunca guarda el archivo ni su nombre en el navegador', () => {
  const setItem = jest.spyOn(Storage.prototype, 'setItem');
  const { rerender } = render(<DocumentUpload available onSelect={() => {}} />);
  fireEvent.change(screen.getByLabelText('Elegir archivo'), { target: { files: [pdf()] } });
  rerender(<DocumentUpload available status="selected" fileName="plan.pdf" onUpload={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));
  expect(setItem).not.toHaveBeenCalled();
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});
