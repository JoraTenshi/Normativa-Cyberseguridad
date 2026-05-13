import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, expect } from 'vitest';
import NormativaCard from './NormativaCard.jsx';

const normativa = {
  id: 'ens',
  nombre: 'Esquema Nacional de Seguridad (ENS)',
  descripcion: 'Marco normativo español.',
  version: 'RD 311/2022',
  total_preguntas: 12,
};

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

it('muestra nombre, versión, descripción y número de preguntas', () => {
  renderWithRouter(<NormativaCard normativa={normativa} />);
  expect(screen.getByText(normativa.nombre)).toBeInTheDocument();
  expect(screen.getByText(normativa.version)).toBeInTheDocument();
  expect(screen.getByText(normativa.descripcion)).toBeInTheDocument();
  expect(screen.getByText(/12 (preguntas|questions)/)).toBeInTheDocument();
});
