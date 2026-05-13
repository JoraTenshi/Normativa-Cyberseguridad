import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, vi, describe } from 'vitest';
import BloquePreguntas from './BloquePreguntas.jsx';

const bloque = {
  id: 'b1',
  nombre: 'Marco Organizativo',
  preguntas: [
    { id: 'p1', pregunta: '¿Existe una política de seguridad?' },
    { id: 'p2', pregunta: '¿Se han designado roles?' },
  ],
};

it('muestra el nombre del bloque y las preguntas', () => {
  render(<BloquePreguntas bloque={bloque} respuestas={{}} onRespuesta={() => {}} />);
  expect(screen.getByText('Marco Organizativo')).toBeInTheDocument();
  expect(screen.getByText('¿Existe una política de seguridad?')).toBeInTheDocument();
  expect(screen.getByText('¿Se han designado roles?')).toBeInTheDocument();
});

it('llama onRespuesta con preguntaId y valor al hacer click en Sí', () => {
  const onRespuesta = vi.fn();
  render(<BloquePreguntas bloque={bloque} respuestas={{}} onRespuesta={onRespuesta} />);
  const siButtons = screen.getAllByRole('button', { name: /yes|sí/i });
  fireEvent.click(siButtons[0]);
  expect(onRespuesta).toHaveBeenCalledWith('p1', 'si');
});

it('llama onRespuesta con "no" al hacer click en No', () => {
  const onRespuesta = vi.fn();
  render(<BloquePreguntas bloque={bloque} respuestas={{}} onRespuesta={onRespuesta} />);
  const noButtons = screen.getAllByRole('button', { name: /^no$/i });
  fireEvent.click(noButtons[1]);
  expect(onRespuesta).toHaveBeenCalledWith('p2', 'no');
});

it('marca el botón seleccionado cuando hay respuesta en respuestas prop', () => {
  render(
    <BloquePreguntas bloque={bloque} respuestas={{ p1: 'si' }} onRespuesta={() => {}} />
  );
  const siButtons = screen.getAllByRole('button', { name: /yes|sí/i });
  expect(siButtons[0]).toHaveClass('ring-2');
});
