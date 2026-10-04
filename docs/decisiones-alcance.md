# Decisiones de alcance — Práctica 3

Fecha: 02/10/2026. Referencia: manual de Práctica 3, §1.2 y §7 (tarea 6).
Solo entran en la entrega `v1.0-practica3` los extras aprobados aquí; se implementan en la
ventana del 8 al 11 de octubre (tarea 14) y no antes del punto de control del 7 de octubre.

| Tema | Decisión | Qué implica |
|---|---|---|
| Exportar a PDF/Word | **Aprobado: imprimir a PDF desde el navegador** | Estilos de impresión y botón "Descargar PDF" (abre el diálogo de impresión) en el informe (`Resultado.jsx`) y en el Plan Director (`PlanDirector.jsx`). Solo frontend, sin dependencias nuevas ni cambios en el backend. No se genera Word. |
| Seguimiento de acciones y evidencias | **Fuera de alcance** | No se añade estado por remediación ni subida de ficheros. Queda como trabajo futuro. |
| Licitaciones | **Congelado tal como está** | Se mantienen el backend (`/licitaciones`) y el scraper sin funciones nuevas ni interfaz. Solo las correcciones ya previstas: `POST /licitaciones/sync` restringido a administradores (tarea 13) y el arreglo de `datetime.UTC` del scraper (tarea 14). **No** se analizan pliegos ni se genera ninguna oferta. |

## Estado de los extras aprobados (tarea 14)

Fecha: 04/10/2026.

- **Descargar PDF: hecho.** Botón "Descargar PDF" en el informe y en el Plan Director (`components/ImprimirPdf.jsx`) que abre el diálogo de impresión; estilos `@media print` en `App.css` (fondo claro, sin menú, pie, banner de cookies ni botones, sin cortar tarjetas entre páginas) y una nota impresa con la fecha y el aviso de que el índice es una autoevaluación y no una certificación. El Plan Director despliega todas las fases antes de imprimir, también con Ctrl+P. Comprobado generando los PDF con Chromium contra la pila Docker: informe en 1 página y Plan Director en 3 con todas las acciones, aunque estuvieran plegadas en pantalla. Pruebas: `backend/tests/descargarPdf.test.js`.
- **Scraper, `datetime.UTC`: corregido.** `datetime.now(datetime.UTC)` lanzaba `AttributeError` (`UTC` es una constante del módulo, no de la clase), así que ninguna sincronización llegaba a guardar licitaciones y todas terminaban con error. Ahora se importa `UTC` del módulo. Comprobado en el contenedor real con un ZIP de prueba: antes, error y nada guardado; después, sin error, la licitación de ciberseguridad guardada con fecha UTC y la de limpieza descartada. Pruebas: `scraper/tests/test_utc.py`, que fallan con el código anterior.
