import React from 'react';
import {Link} from 'react-router-dom';

export default function PreviousEvaluationNotice() {
  return <section className="page previous-evaluation" aria-labelledby="previous-evaluation-title">
    <h1 id="previous-evaluation-title">Continúa en tu espacio de trabajo</h1>
    <p>El cuestionario anterior ya no está disponible para iniciar nuevas evaluaciones. Ahora puedes organizar la actividad de tu empresa, la documentación y las actuaciones en un mismo espacio.</p>
    <p>Las evaluaciones que ya guardaste y sus planes siguen disponibles en tu historial. Sus resultados se conservan tal como se registraron.</p>
    <div className="resultado-acciones">
      <Link className="btn-primary" to="/espacio-de-trabajo">Ir a mi espacio</Link>
      <Link className="btn-secondary" to="/historial">Consultar evaluaciones guardadas</Link>
    </div>
  </section>;
}
