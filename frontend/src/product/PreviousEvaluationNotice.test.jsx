import React from 'react';
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import PreviousEvaluationNotice from './PreviousEvaluationNotice';

test('old questionnaire entry explains the change and keeps access to previous records',()=>{
  render(<MemoryRouter><PreviousEvaluationNotice/></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'Continúa en tu espacio de trabajo'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Ir a mi espacio'})).toHaveAttribute('href','/espacio-de-trabajo');
  expect(screen.getByRole('link',{name:'Consultar evaluaciones guardadas'})).toHaveAttribute('href','/historial');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});

test('active routes no longer mount the old scoring entry but keep protected history and PDS',()=>{
  const fs=require('fs'),path=require('path');
  const app=fs.readFileSync(path.resolve(__dirname,'../App.js'),'utf8');
  expect(app).not.toMatch(/import\s+(Cuestionario|Resultado)\b/);
  expect(app).toMatch(/path="\/cuestionario\/:normativaId" element=\{<PreviousEvaluationNotice/);
  expect(app).toMatch(/path="\/resultado" element=\{<PreviousEvaluationNotice/);
  for(const component of ['Historial','HistorialDetalle','PlanDirector'])expect(app).toContain(`<ProtectedRoute><${component} />`);
  for(const name of ['Historial','HistorialDetalle','PlanDirector']) {
    const source=fs.readFileSync(path.resolve(__dirname,`../pages/${name}.jsx`),'utf8');
    expect(source).not.toContain('/cuestionario/');
    expect(source).not.toMatch(/Nueva evaluación|Repetir evaluación/);
  }
});
