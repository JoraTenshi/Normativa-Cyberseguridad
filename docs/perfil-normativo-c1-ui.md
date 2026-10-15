# Perfil y alcance: conexión del Workspace con NORM-C1

Actualizado el 13 de octubre de 2026. Implementación acotada en
`/home/kali/Documents/practica3/normativa_integracion`, rama
`integracion/workspace-20261011`, base `519605bec` y cambios locales sin commit.

## Qué cambia

El menú del Workspace incorpora **Perfil y alcance**, solo para el administrador
activo de la organización seleccionada. Se conservan el contexto avanzado, la
gestión de operaciones y las demás secciones. No se modifica el diseño de la
portada verde ni su demo local en Windows (4192).

El apartado consume el contrato existente documentado en `perfil-normativo-c1.md`.
No añade endpoints ni reglas de aplicabilidad:

1. Si el contexto no existe, pide un motivo y una acción expresa para iniciarlo.
   No crea empresas, respuestas, tareas ni espacios automáticamente.
2. Obtiene las preguntas del servidor. Presenta empresa y actividades en bloques,
   conserva el estado conocido/desconocido/contradictorio y genera códigos estables
   para las nuevas actividades sin pedir escribir claves técnicas.
3. Guarda solo los datos editados mediante PATCH, con versión, motivo e
   Idempotency-Key. Las preguntas condicionales se actualizan después del guardado.
4. Muestra propuestas de espacios y alcances preliminares. Crear o reutilizar
   espacios exige revisar la selección, indicar un motivo y confirmar expresamente.
   Cada actividad obtiene inicialmente un alcance preliminar independiente.
5. Permite consultar alcances, su procedencia, revisiones anteriores y cambios que
   obligan a revisarlos. Leer no recalcula ni sobrescribe una instantánea histórica.

## Archivos

Todos los archivos funcionales están en `frontend/src/connected/`:

- `CompanyProfile.jsx`: pantallas del recorrido y consumo de la API existente.
- `profile-model.js`: adaptación de respuestas, cambios intencionales, comparación
  de revisiones, identificadores y cuerpo de confirmación. No decide normas.
- `profile.css`: estilos limitados a este apartado, dentro del dashboard existente.
- `ApiWorkspace.jsx`: entrada del menú y restricción por rol organizativo.
- `CompanyProfile.test.jsx`, `profile-model.test.js`, `ApiWorkspace.test.jsx`:
  pruebas de este recorrido y regresión de navegación/roles.

Se reutilizan `createApi`, `useWriter`, `useRemote`, `useDirty` y la sesión existente.
No se incorporan dependencias, tokens en almacenamiento local ni rutas de login de demo.

## Concurrencia y resultados inciertos

- Ante fallo de red o 5xx se bloquea la edición del envío incierto y el reintento
  conserva exactamente cuerpo, método, ruta y clave. No se trocea en guardados ocultos.
- Ante 409 el borrador permanece. Se consulta la revisión actual y se exige elegir
  entre el dato propio y el remoto cuando ambos cambiaron el mismo campo.
- Preparar la nueva revisión no guarda: el usuario revisa y envía de nuevo.
  Solo se reenvían cambios intencionales; no se restauran valores remotos antiguos.
- Los datos ocultos por condiciones no se borran ni se convierten en false.
- La confirmación de espacios no se fuerza con otra clave si la propuesta cambió
  o ya fue materializada. El recibo recuperado no acredita vigencia actual.

## Pruebas realizadas el 13 de octubre

- Frontend: **98/98**, 10 suites; 25 pruebas añadidas en este bloque.
- Build CRA con CI activado: correcto. JS `main.e85d8cc2.js`, CSS `main.c3f98035.css`.
- Suite backend completa ejecutada con reporter dot: exit 0. Sin cambios backend
  de este bloque; no se deduce un total nuevo del reporter.
- NORM-C1: **19 grupos HTTP/Mongo con réplica temporal + 1 negativo standalone**,
  ejecutados de nuevo. Incluyen permisos, CSRF, tenant, reintentos, forja, versiones,
  rollback, índices, referencias ajenas, historial y exportaciones.
- Navegador real sobre el build y la API real, con MongoDB 7.0.43 temporal propio:
  login sintético; selección de empresa; inicio de contexto; guardado de país y
  actividad; confirmación de un espacio/alcance; consulta del alcance y revisión;
  modificación posterior del contexto; aviso de revisión necesaria conservando
  el contexto original del alcance. Sin errores/avisos de consola en la comprobación.
- Vista de alcance comprobada en escritorio y viewport móvil de 390×844; ancho
  de documento y viewport útil 382 px, sin desbordamiento horizontal.
- Hashes de los tres archivos funcionales nuevos coinciden entre preparación local
  y checkout remoto. `git diff --check` correcto para los archivos rastreados; la
  carpeta connected aún es untracked en la integración, como antes de este bloque.

La prueba de navegador utilizó `scripts/serve-workspace-browser-check.js` y el
puerto temporal 4280, no el Docker HTTPS de 9443. El runner no acepta la URI habitual,
no carga .env y crea exclusivamente su propia base sintética. No acredita E2E
completo de MFA, HTTPS desplegado, PDFs o persistencia tras reiniciar contenedores.

## Límites y siguiente bloque

- Código aplicado y compilado; **contenedores de 9443 no actualizados**. No se
  afirma que estas pantallas o todas las rutas nuevas estén desplegadas allí.
- La portada verde y su demo de 4192 siguen separadas del Workspace conectado.
  No se ha sustituido ese trabajo visual ni introducido datos simulados en la API.
- Pendiente: edición guiada de sistemas, información, límites, exclusiones y
  dependencias del alcance; agrupación personalizada de varios servicios en un
  alcance; selector de operaciones por nombre en lugar de identificadores avanzados.
- Pendiente: unir la experiencia verde al flujo autenticado, comprobar los endpoints
  e índices del backend que se vaya a desplegar y activar conjuntamente la versión
  compatible. Actualizar solo web no publica el backend NORM-C1 pendiente.
- Catálogo jurídico productivo vacío; candidatos ENS/RGPD/LOPDGDD/CRA/IA/ISO no son
  decisiones legales ni normas completas evaluadas. Sin publicación jurídica,
  métricas favorables, tareas nuevas, PDS ni IA.
- Sin cambios de app del equipo, secretos, certificados, datos reales, Docker,
  commit, push, saneamiento Git o infraestructura.

La pantalla de tipos de cliente del perfil no sustituye una futura gestión de
clientes reales. La condición «datos declarados» se mantiene en todas las lecturas.
