// Learning content only. Permissions and business state remain owned by the API.
export const GUIDE_VERSION = 1;
export const WORKSPACE_SECTIONS = {
  overview:'Vista general', profile:'Perfil y alcance', operations:'Operaciones y cuestiones',
  rat:'Registro de actividades (RAT)', units:'Finalidades, flujos y privacidad',
  rights:'Solicitudes de derechos', eipd:'Detección EIPD', tasks:'Tareas y responsables',
  documents:'Documentación', regulations:'Normativa del alcance', activity:'Historial de actividad',
  spaces:'Servicios y productos', context:'Contexto de empresa'
};
const SHARED = ['overview', 'documents', 'activity', 'spaces'];
export function canLearnSection(section, role) {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_SECTIONS, section) &&
    (role === 'administrador' || (['colaborador', 'consulta'].includes(role) && SHARED.includes(section)));
}

function chapter(id, title, description, goal, detail, options = {}) {
  return { id, title, ...options, steps: [
    { id:id+'.locate', title:'Sitúa esta parte de tu trabajo', text:description,
      goal:'Localiza la información en la zona resaltada. Puedes seguir utilizando la aplicación.', target:'heading' },
    { id:id+'.understand', title:goal, text:detail,
      goal:'Revísalo a tu ritmo. Usa «Ver» para localizar esta parte de la aplicación sin modificar tu trabajo.', target:'content' }
  ] };
}
const ws = (id, description, goal, detail) => chapter(id, WORKSPACE_SECTIONS[id], description, goal, detail,
  { section:id, path:'/espacio-de-trabajo', group:'Tu empresa' });
export const CHAPTERS = [
  chapter('entry', 'Elegir tu espacio', 'Cada organización tiene su propio trabajo y sus permisos. Si solo tienes una, puedes entrar directamente; si hay varias, comprueba cuál necesitas antes de abrirla.',
    'Distingue empresa, servicio y cuenta', 'Una empresa puede contener varios servicios o productos. Cambiar de empresa no es cambiar de servicio. Si no tienes acceso todavía, entra en Mis solicitudes para consultar o solicitar el alta; la guía no crea una empresa.',
    { path:'/espacio-de-trabajo', group:'Empezar' }),
  ws('overview', 'Aquí se reúnen la actividad y los siguientes pasos de la empresa seleccionada. Las cifras resumen el trabajo registrado; no certifican el cumplimiento.',
    'Encuentra por dónde continuar', 'Busca un acceso a operaciones, documentos o trabajo pendiente. Si no hay registros, el estado vacío es tu punto de partida: no necesitas inventar datos para recorrer esta guía.'),
  ws('profile', 'El perfil describe la actividad y el alcance de tu empresa. Sirve para situar qué debe revisarse, no para declarar que una norma se cumple.',
    'Reconoce el alcance que estás revisando', 'Lee las actividades y condiciones disponibles. Distingue los datos conocidos de lo que falta confirmar. Si editas, tú decides si guardas; cambiar de capítulo respeta el aviso de borrador sin guardar.'),
  ws('operations', 'Una operación concreta qué haces, con qué información y qué dudas debes aclarar. No necesitas empezar reconociendo una ley.',
    'Relaciona una actividad con sus cuestiones', 'Consulta una operación si ya existe y distingue su descripción de las cuestiones pendientes. Puedes volver al listado sin crear otra. Si aún está vacío, identifica dónde iniciarías una operación, sin enviarla para completar la guía.'),
  ws('rat', 'El Registro de Actividades de Tratamiento organiza la descripción de los tratamientos. Su relación con operaciones y revisiones permite conservar el contexto.',
    'Distingue ficha, versión y revisión', 'Localiza las fichas disponibles y sus referencias. Al abrir una, diferencia el contenido actual de una versión anterior. Tener una ficha o adjuntar un archivo no equivale a validar el tratamiento.'),
  ws('units', 'Finalidades, flujos de transferencia y unidades informativas separan tres preguntas: para qué tratas datos, hacia dónde circulan y cómo lo explicas.',
    'Explora las tres clases de información', 'Usa las opciones de finalidad, flujo y unidad informativa. Comprueba qué relaciones y versiones ofrece cada ficha accesible. No es necesario crear registros ni completar datos personales para aprender a distinguirlas.'),
  ws('rights', 'Las solicitudes de derechos conservan el contexto del expediente. Una solicitud y las pretensiones que contiene son elementos distintos.',
    'Reconoce solicitud y pretensión', 'Localiza el listado y las opciones para consultar sus detalles y versiones. No introduzcas datos de personas para probar la guía. Los permisos y las acciones disponibles los confirma el servidor.'),
  ws('eipd', 'La detección EIPD organiza la información para valorar si corresponde una evaluación de impacto. No es por sí misma una evaluación terminada.',
    'Identifica lo que falta revisar', 'Consulta una detección existente, sus referencias y versiones cuando estén disponibles. Distingue una cuestión pendiente de una conclusión revisada. Un listado vacío no te impide comprender esta sección.'),
  ws('tasks', 'Las actuaciones conectan el trabajo pendiente con su motivo, sus responsables y su estado. Una tarea cerrada no demuestra automáticamente que una obligación esté acreditada.',
    'Conecta motivo, responsable y siguiente paso', 'Abre una actuación accesible y busca esas tres piezas. Distingue los cambios de la tarea de la revisión del requisito. No necesitas asignar, cerrar ni guardar nada para explorar este capítulo.'),
  ws('documents', 'La documentación conserva archivos, metadatos y versiones vinculados al trabajo de tu empresa. Aportar un documento y revisar su contenido son pasos distintos.',
    'Reconoce el documento y su contexto', 'Si tienes documentos accesibles, consulta sus datos y versiones. No necesitas subir ni descargar un archivo para usar la guía. Si no aparece una acción de edición, puede depender de tu permiso; la guía no lo amplía.'),
  ws('regulations', 'Normativa del alcance relaciona requisitos, fuentes y actuaciones. Distingue una referencia legal, un compromiso contractual y un marco de referencia.',
    'Sigue el motivo de una actuación', 'Explora el catálogo y las opciones disponibles: requisitos, sistemas, sujetos funcionales, designaciones, actuaciones, evidencias y revisiones. Consulta fuente y versión cuando existan. ENS y protección de datos se revisan según el alcance; aparecer en un catálogo no demuestra que una norma te sea aplicable.'),
  ws('activity', 'El historial de actividad registra eventos del trabajo realizado. No es una gráfica de evolución del cumplimiento ni sustituye la revisión de las obligaciones.',
    'Localiza un cambio sin confundirlo con cumplimiento', 'Prueba los filtros de consulta o el orden cuando estén disponibles. Una exportación puede requerir permisos adicionales. No necesitas exportar nada ni provocar nuevos eventos para completar este capítulo.'),
  ws('spaces', 'Los servicios y productos permiten separar lo que ofrece una misma empresa. No son cuentas nuevas ni organizaciones independientes.',
    'Sitúa cada servicio dentro de la empresa', 'Consulta los espacios disponibles. Según tu rol podrás ver acciones de creación o edición; no debes ejecutarlas para aprender. Comprueba primero la empresa activa antes de trabajar sobre un servicio.'),
  ws('context', 'El contexto reúne información de la empresa que ayuda a interpretar sus operaciones y requisitos. Es distinto del estado de una tarea concreta.',
    'Distingue datos conocidos de información pendiente', 'Revisa qué información hay y qué debes confirmar. Puedes explorar sin editar. Si decides modificar un campo, el guardado y cualquier confirmación siguen siendo los de la aplicación, no los de la guía.'),
  chapter('account', 'Mi cuenta y seguridad', 'Tu cuenta es personal; las membresías determinan a qué empresas accedes. La seguridad de la cuenta no equivale a los permisos de cada empresa.',
    'Reconoce la protección de tu cuenta', 'Localiza el estado del segundo factor. No debes activarlo, desactivarlo ni generar un QR para terminar la guía. Si eliges cambiarlo, sigue el flujo de seguridad normal y conserva sus advertencias.',
    { path:'/settings', group:'Tu cuenta' }),
  chapter('requests', 'Mis solicitudes', 'Aquí solicitas un espacio de empresa y sigues la revisión. Verificar el correo no activa por sí solo una organización.',
    'Reconoce el estado y el siguiente paso', 'Consulta una solicitud si existe. Si no hay ninguna, identifica cómo se iniciaría sin enviarla por probar. Un administrador de empresa no es necesariamente quien revisa altas de toda la plataforma.',
    { path:'/solicitudes-de-alta', group:'Tu cuenta' }),
  chapter('history', 'Evaluaciones guardadas', 'Estas evaluaciones pertenecen al cuestionario anterior. Conservan su contexto original y no describen por sí solas la situación actual de tu empresa.',
    'Distingue resultado guardado y situación actual', 'Si tienes resultados, abre uno para consultar su detalle y su plan. Si no hay ninguno, no necesitas crear una evaluación. No confundas este historial con los eventos de actividad del espacio de empresa.',
    { path:'/historial', group:'Consulta' }),
  chapter('result', 'Detalle de evaluación', 'Estás consultando un resultado guardado en su contexto original, no una medición en tiempo real.',
    'Reconoce el alcance de este resultado', 'Lee la información disponible y el acceso a su plan. No interpretes sus cifras como certificación ni como actualización automática de tu situación actual.',
    { contextual:true, group:'Consulta' }),
  chapter('plan', 'Plan director guardado', 'Este plan pertenece a una evaluación concreta. Consultarlo no actualiza automáticamente las obligaciones ni las actuaciones del espacio de empresa.',
    'Identifica de qué evaluación procede el plan', 'Revisa sus medidas y su contexto. La guía no modifica el plan ni obliga a descargarlo. Distingue esta consulta de la gestión cotidiana de tareas de tu empresa.',
    { contextual:true, group:'Consulta' }),
  chapter('review', 'Revisión de altas', 'Este espacio utiliza permisos de plataforma independientes de los de administración de una empresa.',
    'Separa consultar de decidir', 'Localiza solicitudes, estados y detalles accesibles. Aprobar, rechazar o pedir aclaraciones son decisiones reales: no debes ejecutarlas para terminar la guía. Si se requiere una autenticación reciente, sigue la indicación de seguridad de la aplicación.',
    { contextual:true, group:'Plataforma' })
];

export const STEP_IDS = new Set(CHAPTERS.flatMap(ch => ch.steps.map(step => step.id)));
export function chaptersFor(surface) {
  const globals = CHAPTERS.filter(ch => ['account','requests','history'].includes(ch.id));
  if (!surface?.ready) return [];
  const workspace = surface.kind === 'workspace'
    ? CHAPTERS.filter(ch => ch.id === 'entry' || (ch.section && canLearnSection(ch.section, surface.role)))
    : CHAPTERS.filter(ch => ch.id === 'entry');
  const contextual = CHAPTERS.filter(ch => ch.contextual && ch.id === surface.chapter && surface.allowed === true);
  return [...workspace, ...globals, ...contextual];
}

export function hasArrived(chapter, surface) {
  return !!chapter && !!surface?.ready && (chapter.section
    ? surface.kind === 'workspace' && surface.section === chapter.section && canLearnSection(chapter.section, surface.role)
    : surface.chapter === chapter.id);
}
