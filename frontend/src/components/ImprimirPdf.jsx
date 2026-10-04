import React from 'react';

// "Descargar PDF": abre el diálogo de impresión del navegador, donde se elige "Guardar como PDF".
// Sin librerías ni backend (docs/decisiones-alcance.md). El aspecto impreso está en App.css (@media print).
export const BotonDescargarPdf = () => (
  <button type="button" className="btn-secondary" onClick={() => window.print()}>
    Descargar PDF
  </button>
);

// Solo aparece en el documento impreso.
export const NotaImpresion = () => (
  <p className="solo-impresion nota-impresion">
    Generado el {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.
    Índice de autoevaluación basado en las respuestas declaradas; no es una certificación ni una verificación de evidencias.
  </p>
);
