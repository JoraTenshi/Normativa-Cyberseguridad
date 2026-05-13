import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LanguageSelector from './LanguageSelector.jsx';
import i18n from '../i18n/index.js';

describe('LanguageSelector', () => {
  it('renders a select with ES, EN, DE, FR options', () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ES' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DE' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'FR' })).toBeInTheDocument();
  });

  it('changes i18n language when an option is selected', () => {
    render(<LanguageSelector />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });
    expect(i18n.language).toBe('en');
    fireEvent.change(select, { target: { value: 'es' } });
    expect(i18n.language).toBe('es');
  });
});
