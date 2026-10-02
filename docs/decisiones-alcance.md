# Decisiones de alcance — Práctica 3

Fecha: 02/10/2026. Referencia: manual de Práctica 3, §1.2 y §7 (tarea 6).
Solo entran en la entrega `v1.0-practica3` los extras aprobados aquí; se implementan en la
ventana del 8 al 11 de octubre (tarea 14) y no antes del punto de control del 7 de octubre.

| Tema | Decisión | Qué implica |
|---|---|---|
| Exportar a PDF/Word | **Aprobado: imprimir a PDF desde el navegador** | Estilos de impresión y botón "Descargar PDF" (abre el diálogo de impresión) en el informe (`Resultado.jsx`) y en el Plan Director (`PlanDirector.jsx`). Solo frontend, sin dependencias nuevas ni cambios en el backend. No se genera Word. |
| Seguimiento de acciones y evidencias | **Fuera de alcance** | No se añade estado por remediación ni subida de ficheros. Queda como trabajo futuro. |
| Licitaciones | **Congelado tal como está** | Se mantienen el backend (`/licitaciones`) y el scraper sin funciones nuevas ni interfaz. Solo las correcciones ya previstas: `POST /licitaciones/sync` restringido a administradores (tarea 13) y el arreglo de `datetime.UTC` del scraper (tarea 14). **No** se analizan pliegos ni se genera ninguna oferta. |
