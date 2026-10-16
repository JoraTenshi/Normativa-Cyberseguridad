# Candidato conjunto de NormativaCheck — 16 de octubre de 2026

Esta entrega conserva el código verde de R4 y el incremento E1 existente. Es un
candidato de integración, no una declaración de despliegue, de aceptación de
producción ni de cobertura completa de ENS o protección de datos.

## Estado de las funciones

- ENS: cuatro fichas activas y categorización heredada; no todo el ENS.
- RGPD28: ficha de formalización y contenido del encargo; no todo el artículo.
- RAT y RGPD32: implementación de backend/frontend y pruebas reales parciales de
  una compilación anterior. Falta repetir las correcciones de interfaz, el
  conflicto entre dos editores, el recorrido RGPD32 y evidencia/descarga sobre
  este corte exacto.
- Finalidades y flujos: backend y formularios integrados en código; pendiente la
  validación conjunta final con API, MongoDB y navegador.
- Unidad informativa: backend y nueva interfaz de información de privacidad;
  pendiente el recorrido final con navegador.
- Solicitudes y pretensiones de derechos: backend y nuevas pantallas de
  solicitudes y peticiones concretas, incluida sustitución técnica trazable.
  Su menú no es «Mis solicitudes», que pertenece a altas de cuentas.
- Detección EIPD: backend persistente y nueva interfaz de detección orientativa;
  pendiente el recorrido final con navegador. No realiza ni aprueba una EIPD.
- DPD y brechas: lógica local de detección, no gestión integral implementada.
- Los paquetes editoriales adicionales no son por sí mismos funciones operativas.

## Evidencia y límites

Los responsables entregaron 1363 pruebas locales de Backend y 497 pruebas de
Frontend en 42 suites. La API de las pruebas de Frontend está simulada. No se
suman estos resultados con ejecuciones anteriores ni equivalen a una prueba de
principio a fin del candidato. El build de Frontend entregado para validación
es `main.ec976e31.js`, SHA-256
`db7438203d4eb3e5a4c560ad18fd2c1e6bb50c557f32329cc41b717cdfbce7dd`.

Backend también entregó nueve escenarios de derechos y nueve de EIPD con API
y MongoDB reales sobre réplicas y datos sintéticos separados. Utilizaron una
política JWT de pruebas: no acreditan sesiones persistentes/MFA ni interfaz.

El catálogo activo contiene diez fichas, cuatro de ENS. Terminar una tarea no
acredita cumplimiento. Consultar un resultado hoy no significa haber revisado
hoy la vigencia de sus fuentes; el mero paso del día no invalida el histórico.

## Publicación y operación

Guardar este candidato en GitHub no lo convierte en la versión final de `main`
ni en la versión desplegada en Hetzner. La aceptación requiere comprobar el
corte exacto, los datos existentes, HTTPS privado, persistencia y recuperación.
El ensayo Docker preparado originalmente para R4 no acredita E1.

No ejecutar sobre datos reales los scripts sintéticos de `qa-dev`. No copiar
credenciales, bases de datos, certificados privados, estados de ejecución ni
archivos `.env` al repositorio. Los archivos `.env.example` son plantillas.

Las ramas y versiones anteriores se conservan hasta revisar commits propios,
referencias, dependencias y datos. No hay autorización implícita de borrado por
el mero hecho de publicar este candidato.
