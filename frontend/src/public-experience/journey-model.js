/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
// Explanatory scenarios, not automatic legal decisions or connected client data.
export const INTRO_TIMING = { gather:1500, bloom:1000, read:6500, review:9000 };
export const JOURNEY_STAGES = ['Tu actividad','Qué necesitas revisar','Documentos que reúnes','Plan de trabajo'];
export const JOURNEYS = [
  {
    id:'saas', label:'Tu SaaS', subtitle:'Datos, proveedores y compromisos con clientes', icon:'cloud', tone:'sage',
    intro:'Operas un SaaS con contactos y tickets de tus clientes.',
    network:[['users','Clientes',16,55],['cloud','Tu plataforma',50,35],['database','Sus datos',84,55]], edges:[[0,1],[1,2]],
    captions:['Tus clientes incorporan información a la plataforma que tú operas.','Aclaras qué datos tratas por cuenta de tus clientes y quién más accede.','Compruebas que lo acordado sobre los datos coincide con cómo funciona el servicio.','Asignas quién completa la documentación y quién revisa las condiciones con el cliente.'],
    review:[{icon:'database',title:'Datos y operaciones',text:'Qué contienen los tickets y adjuntos; qué conservas y durante cuánto tiempo.'},{icon:'key',title:'Accesos de terceros',text:'Qué proveedores intervienen y con qué permisos. Comprueba que lo acordado coincide con el funcionamiento del servicio.'}],
    reference:'Protección de datos · condiciones del encargo, si procede',
    documents:[{icon:'document',title:'Anexo de tratamiento',text:'Contrasta instrucciones, operaciones y condiciones de devolución o eliminación al finalizar el servicio.'},{icon:'inventory',title:'Mapa de datos y proveedores',text:'Reúne categorías de datos, funciones del servicio y proveedores que intervienen; señala lo que falta confirmar.'}],
    plan:{icon:'plan',title:'Completar y revisar el encargo',owner:'Operaciones + equipo técnico',steps:['Identificar datos','Actualizar el anexo','Revisar la versión'],text:'Operaciones coordina el anexo; el equipo técnico confirma datos y accesos. Conserva el resultado para su revisión, sin dar por validado el cumplimiento.'},
  },
  {
    id:'soporte', label:'Soporte e integración', subtitle:'Accedes a sistemas de terceros', icon:'tools', tone:'blue',
    intro:'Tu equipo conecta servicios y mantiene sistemas de clientes.',
    network:[['tools','Tu equipo',16,35],['key','Acceso remoto',50,55],['server','Sistema cliente',84,35]], edges:[[0,1],[1,2]],
    captions:['El mantenimiento conecta a tu equipo con sistemas que no son tuyos.','Distingues lo contratado del acceso que realmente necesita cada intervención.','Reúnes el contrato de mantenimiento y las autorizaciones de acceso.','Dejas claro quién puede acceder, para qué y quién debe revisar esos permisos.'],
    review:[{icon:'key',title:'Permisos necesarios',text:'Quién entra en producción, para qué, durante cuánto tiempo y cómo se retira el acceso.'},{icon:'handshake',title:'Límites del servicio',text:'Qué mantiene tu equipo y qué sigue siendo responsabilidad del cliente; si se accede a datos personales.'}],
    reference:'Contrato de soporte · protección de datos según el acceso',
    documents:[{icon:'document',title:'Anexo de mantenimiento',text:'Identifica sistemas cubiertos, intervenciones, horarios y responsabilidades. Contrasta la versión aceptada por el cliente.'},{icon:'key',title:'Registro de autorizaciones',text:'Reúne responsables, cuentas, motivo y vigencia del acceso; marca las cuentas o permisos que requieren aclaración.'}],
    plan:{icon:'tools',title:'Delimitar el soporte y los accesos',owner:'Responsable técnico',steps:['Acordar los límites','Revisar permisos','Registrar los cambios'],text:'El responsable técnico concreta el acceso con el cliente y deja una revisión de permisos asignada. El contrato y la práctica deben describir el mismo servicio.'},
  },
  {
    id:'publico', label:'Proveedores del sector público', subtitle:'Trabajas con Administraciones', icon:'civic', tone:'ochre',
    intro:'Tu empresa presta una solución a una Administración.',
    network:[['company','Tu empresa',18,58],['civic','Administración',50,24],['server','Sistemas',82,58]], edges:[[0,1],[1,2],[0,2]],
    captions:['Tu servicio se vincula a un contrato público y a unos sistemas concretos.','Antes de decidir qué requisitos revisar, identificas el servicio y los sistemas incluidos.','Relacionas el contrato con los sistemas, la información y sus responsables.','Documentas los sistemas incluidos y asignas la revisión de las medidas que correspondan.'],
    review:[{icon:'civic',title:'Ámbito del ENS',text:'Qué servicio se presta, para qué entidad y qué sistemas intervienen. No se presume categoría ni conformidad.'},{icon:'layers',title:'Reparto de responsabilidades',text:'Qué operas tú, qué aporta la Administración y qué depende de otros proveedores.'}],
    reference:'ENS · ámbito condicionado al contrato y a los sistemas',
    documents:[{icon:'document',title:'Contrato y pliegos',text:'Reúne los requisitos de seguridad del servicio contratado y las condiciones que debéis contrastar.'},{icon:'inventory',title:'Mapa de sistemas y responsables',text:'Relaciona información, sistemas, proveedores y responsables con el servicio público prestado.'}],
    plan:{icon:'civic',title:'Delimitar el servicio y su revisión',owner:'Seguridad + responsable del contrato',steps:['Identificar sistemas','Contrastar el ámbito','Asignar la revisión'],text:'El equipo documenta qué sistemas sostienen el servicio y qué cuestiones siguen abiertas antes de determinar las medidas que corresponden.'},
  },
  {
    id:'soc', label:'SOC y seguridad gestionada', subtitle:'Accesos, responsabilidades y procedimientos acordados', icon:'radar', tone:'teal',
    intro:'Monitorizas eventos y gestionas alertas de tus clientes.',
    network:[['server','Sistemas',16,23],['database','Registros',16,78],['radar','Tu SOC',51,50],['alert','Escalado',84,50]], edges:[[0,2],[1,2],[2,3]],
    captions:['Tu SOC recibe registros de varias fuentes y decide cómo escalar una alerta.','Organizas qué debe revisar tu equipo y qué debe confirmar el cliente.','Reúnes el procedimiento de escalado y la matriz de acceso a las consolas.','Asignas la revisión del procedimiento y documentas una comprobación.'],
    review:[{icon:'database',title:'Uso de registros',text:'Qué información llega al SOC, quién la consulta y qué conservación está acordada.'},{icon:'alert',title:'Quién responde',text:'Qué alertas escalas, a quién avisas y qué acciones requieren autorización del cliente.'}],
    reference:'Acuerdo de servicio · datos, accesos y respuesta a incidentes',
    documents:[{icon:'plan',title:'Protocolo de escalado',text:'Contactos, criterios de prioridad, canales y actuaciones autorizadas. Contrasta el protocolo con lo pactado.'},{icon:'key',title:'Matriz de accesos del SOC',text:'Consolas y fuentes accesibles por rol; autorizaciones y cuentas que necesitan revisión.'}],
    plan:{icon:'radar',title:'Coordinar y comprobar el escalado',owner:'Responsable del SOC + cliente',steps:['Confirmar contactos','Revisar accesos','Comprobar el protocolo'],text:'Asigna una comprobación del procedimiento con el cliente y conserva el resultado. No se simula una detección real ni un servicio de respuesta activo.'},
  },
  {
    id:'software', label:'Productos software', subtitle:'Desarrollas, entregas y mantienes', icon:'code', tone:'indigo',
    intro:'Desarrollas un producto que tus clientes instalan y utilizan.',
    network:[['code','Tu desarrollo',16,50],['package','Versión',50,50],['layers','Componentes',83,20],['users','Clientes',83,80]], edges:[[0,1],[2,1],[1,3]],
    captions:['Tu producto reúne código y componentes en versiones que llegan a clientes.','Relacionas las revisiones de seguridad con versiones y compromisos de soporte.','Reúnes el inventario de componentes, las versiones y las condiciones de soporte.','Organizas correcciones, responsables y comunicación de cambios.'],
    review:[{icon:'layers',title:'Componentes y versiones',text:'Qué dependencias incluyes, qué versiones mantienes y qué incidencias de seguridad conoces.'},{icon:'tools',title:'Mantenimiento comprometido',text:'Qué soporte has ofrecido, durante cuánto tiempo y cómo comunicas una actualización.'}],
    reference:'Requisitos del producto y del cliente · ámbito por contrastar',
    documents:[{icon:'inventory',title:'Inventario de componentes',text:'Relaciona versiones, dependencias y sus responsables; reúne la información disponible sobre incidencias.'},{icon:'document',title:'Registro de versiones y soporte',text:'Identifica entregas, cambios, condiciones aceptadas y cómo se informa a los clientes afectados.'}],
    plan:{icon:'code',title:'Priorizar la revisión del producto',owner:'Desarrollo + responsable de producto',steps:['Revisar dependencias','Asignar correcciones','Registrar la entrega'],text:'Organiza los hallazgos que aporte tu equipo, asigna acciones y conserva qué versión los atiende. NormativaCheck no ejecuta un escaneo técnico. Las obligaciones legales requieren revisar las características del producto y su ámbito.'},
  },
  {
    id:'pentesting', label:'Pentesting', subtitle:'Autorizaciones, límites y entrega de evidencias', icon:'target', tone:'clay',
    intro:'Tu equipo realiza pruebas de seguridad para un cliente.',
    network:[['document','Autorización',18,25],['target','Pruebas',50,54],['server','Activos acordados',82,25]], edges:[[0,1],[1,2]],
    captions:['La prueba parte de una autorización y de unos activos delimitados.','Aclaras límites, condiciones y tratamiento de las evidencias antes de actuar.','Reúnes la autorización y las reglas del trabajo, no solo el informe final.','Conviertes las dudas previas y los hallazgos en acciones trazables.'],
    review:[{icon:'target',title:'Qué está autorizado',text:'Activos, ventana de pruebas, técnicas acordadas y condiciones de parada.'},{icon:'shield',title:'Cómo proteges las evidencias',text:'Quién accede a los resultados, cómo se entregan y cuándo se devuelven o eliminan.'}],
    reference:'Autorización y condiciones del encargo · confidencialidad',
    documents:[{icon:'document',title:'Autorización y reglas del trabajo',text:'Identifica el cliente, los activos y las condiciones aceptadas. Señala cualquier permiso o límite pendiente de confirmar.'},{icon:'shield',title:'Informe y registro de evidencias',text:'Mantén trazabilidad entre hallazgo, evidencia y revisión; controla la entrega y el acceso a material sensible.'}],
    plan:{icon:'target',title:'Cerrar límites y preparar la entrega',owner:'Responsable de pruebas + cliente',steps:['Confirmar autorización','Aclarar restricciones','Revisar la entrega'],text:'Las cuestiones de autorización deben resolverse antes de la prueba. Organiza el informe, sus controles de acceso y la persona que lo revisará. La aplicación no ejecuta las pruebas de pentesting.'},
  },
  {
    id:'consultoria', label:'Consultoría de ciberseguridad', icon:'compass', tone:'olive',
    intro:'Asesoras a clientes sobre cómo organizar su seguridad.',
    network:[['users','Tu cliente',17,28],['inventory','Información',17,78],['compass','Tu revisión',53,52],['plan','Propuesta',85,52]], edges:[[0,2],[1,2],[2,3]],
    captions:['Relacionas la situación del cliente y sus documentos con una revisión delimitada.','Separas información declarada, evidencias disponibles y puntos sin confirmar.','Reúnes el alcance del encargo y la matriz que respalda tus recomendaciones.','Priorizas aclaraciones y revisiones con responsables, sin prometer certificación.'],
    review:[{icon:'compass',title:'Límites del encargo',text:'Qué asesoramiento has acordado prestar y qué decisiones corresponden al cliente o a otro profesional.'},{icon:'inventory',title:'Respaldo de las recomendaciones',text:'Qué documentos sostienen cada observación y qué afirmaciones todavía requieren revisión.'}],
    reference:'Contrato de asesoramiento · evidencias y criterios de revisión',
    documents:[{icon:'document',title:'Alcance y entregables acordados',text:'Concreta servicios, límites, destinatarios de las recomendaciones y criterios de entrega.'},{icon:'inventory',title:'Matriz de cuestiones y evidencias',text:'Relaciona observaciones, documentos y dudas abiertas. Evita tratar una declaración como evidencia revisada.'}],
    plan:{icon:'compass',title:'Revisar y priorizar recomendaciones',owner:'Consultoría + interlocutor del cliente',steps:['Resolver dudas','Contrastar evidencias','Priorizar acciones'],text:'Asigna las aclaraciones y revisiones necesarias antes de cerrar recomendaciones. La herramienta organiza el trabajo; no convierte asesoramiento en auditoría o certificación.'},
  },
];
export const JOURNEY_START = {mode:'picker',id:null,stage:0,manual:false,detail:null,run:0};
export function journeyReducer(state,event) {
  const returning=state.mode==='return-bloom'||state.mode==='return-gather';
  if(event.type==='back') {
    if(!state.id||returning)return state;
    if(event.reduce)return {...JOURNEY_START,run:state.run+1};
    return {...state,mode:state.mode==='gather'?'return-gather':'return-bloom',detail:null,manual:true};
  }
  if(event.type==='choose') return JOURNEYS.some(c=>c.id===event.id)?{...JOURNEY_START,mode:event.reduce?'diagram':'gather',id:event.id,stage:event.reduce?3:0,manual:!!event.reduce,run:state.run+1}:state;
  if(event.type==='reset') return {...JOURNEY_START,run:state.run+1};
  if(event.type==='replay' && state.id) return {...state,mode:'diagram',stage:0,detail:null,manual:!!event.reduce,run:state.run+1};
  if(event.type==='reduce' && state.id) return returning?{...JOURNEY_START,run:state.run+1}:{...state,mode:'diagram',stage:3,manual:true};
  if(event.type==='tick') {
    if(state.mode==='return-bloom')return {...state,mode:'return-gather'};
    if(state.mode==='return-gather')return {...JOURNEY_START,run:state.run+1};
    if(state.mode==='gather') return {...state,mode:'bloom'};
    if(state.mode==='bloom') return {...state,mode:'diagram'};
    if(state.mode==='diagram' && !state.manual) return {...state,stage:Math.min(3,state.stage+1)};
  }
  if(event.type==='next' && state.mode==='diagram') return {...state,stage:Math.min(3,state.stage+1),manual:true,detail:null};
  if(event.type==='all' && state.mode==='diagram') return {...state,stage:3,manual:true,detail:null};
  if(event.type==='detail' && state.mode==='diagram') return {...state,manual:true,detail:event.node};
  if(event.type==='close') return {...state,detail:null};
  return state;
}
