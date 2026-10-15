/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
// Presentation content for each local scenario. Review indexes retain its detailed context.
export const JOURNEY_NARRATIVES = {
  saas: {
    explanations: [
      'Tu plataforma recibe información de clientes. Identifica qué datos entran y quién interviene en el servicio.',
      'Aclara el recorrido de los datos antes de revisar las condiciones que acuerdas con tus clientes.',
      'Cruza lo que dice el anexo con los datos, accesos y proveedores que utiliza tu plataforma.',
      'Reparte la información que falta confirmar y prepara una nueva versión del anexo para revisarla con tu cliente.',
    ],
    checks: [
      {icon:'database',title:'Qué datos entran',summary:'Contactos, tickets y adjuntos.',review:0},
      {icon:'inventory',title:'Cuánto se conservan',summary:'Plazos y cierre del servicio.',review:0},
      {icon:'users',title:'Quién interviene',summary:'Proveedores y funciones.',review:1},
      {icon:'key',title:'Qué acceso tienen',summary:'Permisos e instrucciones.',review:1},
    ],
    documentNotes:['Qué se acuerda sobre el tratamiento.','Qué ocurre realmente en el servicio.'],
    actions: [
      {title:'Confirmar datos y accesos',owner:'Equipo técnico',result:'Mapa de datos y proveedores actualizado.'},
      {title:'Completar el anexo',owner:'Operaciones',result:'Borrador que recoge lo confirmado.'},
      {title:'Contrastar las condiciones',owner:'Operaciones + cliente',result:'Versión revisada y dudas registradas.'},
    ],
  },
  soporte: {
    explanations: [
      'Tu equipo mantiene sistemas de clientes. Sitúa qué conectas, a qué accedes y de quién es cada sistema.',
      'Compara el soporte contratado con los permisos que necesita cada intervención.',
      'Contrasta el contrato con las autorizaciones: lo pactado y el acceso real deben describir el mismo servicio.',
      'Acordad los límites del soporte, ajustad los permisos y dejad constancia de cada cambio para su revisión.',
    ],
    checks: [
      {icon:'key',title:'Quién puede entrar',summary:'Cuentas y permisos necesarios.',review:0},
      {icon:'tools',title:'Para qué y hasta cuándo',summary:'Motivo y vigencia del acceso.',review:0},
      {icon:'handshake',title:'Qué cubre el soporte',summary:'Sistemas y tareas acordadas.',review:1},
      {icon:'users',title:'Qué asume el cliente',summary:'Límites y responsabilidades.',review:1},
    ],
    documentNotes:['Servicios y responsabilidades pactados.','Cuentas, permisos y vigencia del acceso.'],
    actions: [
      {title:'Acordar qué cubres',owner:'Responsable técnico + cliente',result:'Anexo de mantenimiento actualizado.'},
      {title:'Ajustar los permisos',owner:'Administración de sistemas',result:'Accesos justificados; sobrantes retirados.'},
      {title:'Programar la revisión',owner:'Responsable técnico',result:'Fecha, responsable y registro de cambios.'},
    ],
  },
  publico: {
    explanations: [
      'Tu solución presta un servicio a una Administración. Relaciona el contrato con los sistemas que lo sostienen.',
      'Delimita el servicio y sus responsabilidades antes de valorar qué exigencias del ENS corresponden.',
      'Reúne las condiciones del contrato y el mapa de sistemas para justificar el ámbito que debe revisarse.',
      'Resuelve qué sistemas entran en el servicio y encarga la revisión de los requisitos que correspondan a ese ámbito.',
    ],
    checks: [
      {icon:'civic',title:'Qué servicio prestas',summary:'Entidad y objeto del contrato.',review:0},
      {icon:'server',title:'Qué sistemas intervienen',summary:'Información y recursos incluidos.',review:0},
      {icon:'company',title:'Qué operas tú',summary:'Funciones y medios propios.',review:1},
      {icon:'users',title:'Qué aportan otros',summary:'Administración y proveedores.',review:1},
    ],
    documentNotes:['Condiciones de seguridad del encargo.','Servicio, información y responsables.'],
    actions: [
      {title:'Delimitar los sistemas',owner:'Equipo técnico',result:'Mapa vinculado al servicio contratado.'},
      {title:'Contrastar el ámbito',owner:'Seguridad + responsable del contrato',result:'Decisión documentada y dudas abiertas.'},
      {title:'Asignar las revisiones',owner:'Responsable de seguridad',result:'Requisitos a revisar, responsables y fechas.'},
    ],
  },
  soc: {
    explanations: [
      'Tu SOC recibe registros y gestiona alertas. Visualiza de dónde llegan y cómo se comunican al cliente.',
      'Aclara el uso de los registros y quién puede decidir o actuar cuando aparece una alerta.',
      'Relaciona las personas que acceden a las consolas con el procedimiento que deben seguir ante una alerta.',
      'Acordad el escalado con el cliente y comprobad que los contactos, permisos y actuaciones encajan con lo pactado.',
    ],
    checks: [
      {icon:'database',title:'Qué registros recibes',summary:'Fuentes y datos incluidos.',review:0},
      {icon:'key',title:'Quién los consulta',summary:'Accesos y conservación.',review:0},
      {icon:'alert',title:'A quién avisas',summary:'Prioridad, contacto y canal.',review:1},
      {icon:'shield',title:'Qué puedes ejecutar',summary:'Acciones autorizadas por el cliente.',review:1},
    ],
    documentNotes:['Cuándo avisar y qué actuación seguir.','Qué consola puede utilizar cada rol.'],
    actions: [
      {title:'Confirmar el escalado',owner:'SOC + interlocutor del cliente',result:'Contactos y canales actualizados.'},
      {title:'Revisar las consolas',owner:'Administración del SOC',result:'Matriz de accesos revisada.'},
      {title:'Ensayar el procedimiento',owner:'Responsable del SOC + cliente',result:'Acta de la prueba y ajustes pendientes.'},
    ],
  },
  software: {
    explanations: [
      'Tu producto combina código y dependencias. Relaciona cada versión con sus componentes y clientes.',
      'Cruza las versiones entregadas y sus incidencias con el mantenimiento que has comprometido.',
      'Usa el inventario y el registro de versiones para localizar qué componente y qué entrega necesitan atención.',
      'Prioriza los hallazgos de tu equipo, asigna su corrección y registra qué versión se entrega a los clientes afectados.',
    ],
    checks: [
      {icon:'layers',title:'Qué incluyes',summary:'Dependencias y versiones.',review:0},
      {icon:'alert',title:'Qué fallos conoces',summary:'Incidencias aportadas por tu equipo.',review:0},
      {icon:'tools',title:'Qué soporte ofreces',summary:'Compromisos y plazos.',review:1},
      {icon:'package',title:'Cómo actualizas',summary:'Entrega y aviso a clientes.',review:1},
    ],
    documentNotes:['Componentes de cada versión.','Entregas y mantenimiento comprometido.'],
    actions: [
      {title:'Localizar versiones afectadas',owner:'Desarrollo',result:'Hallazgos vinculados a componentes.'},
      {title:'Asignar las correcciones',owner:'Responsable de producto',result:'Tareas priorizadas, responsables y fechas.'},
      {title:'Preparar la actualización',owner:'Desarrollo + soporte',result:'Versión, comprobaciones y aviso de entrega.'},
    ],
  },
  pentesting: {
    explanations: [
      'Tu equipo prueba la seguridad de un cliente. Vincula las pruebas con los activos y la autorización recibida.',
      'Confirma los límites antes de actuar y cómo protegerás las evidencias que genere el trabajo.',
      'Relaciona la autorización y las reglas acordadas con el informe y las evidencias que entregarás.',
      'Resuelve permisos y restricciones antes de probar. Después, prepara y revisa la entrega de resultados al cliente.',
    ],
    checks: [
      {icon:'server',title:'Qué puedes probar',summary:'Activos incluidos en el permiso.',review:0},
      {icon:'target',title:'Con qué límites',summary:'Ventana, técnicas y parada.',review:0},
      {icon:'key',title:'Quién ve las evidencias',summary:'Acceso y entrega segura.',review:1},
      {icon:'shield',title:'Qué ocurre al terminar',summary:'Devolución o eliminación acordada.',review:1},
    ],
    documentNotes:['Permiso y condiciones previas a la prueba.','Resultados y trazabilidad de su entrega.'],
    actions: [
      {title:'Confirmar la autorización',owner:'Responsable de pruebas + cliente',result:'Permiso y activos confirmados antes de probar.'},
      {title:'Cerrar las restricciones',owner:'Equipo de pruebas + cliente',result:'Ventana, técnicas y parada acordadas.'},
      {title:'Revisar y entregar el informe',owner:'Responsable de pruebas',result:'Informe revisado y entrega registrada.'},
    ],
  },
  consultoria: {
    explanations: [
      'Asesoras a un cliente sobre su seguridad. Relaciona su situación y sus documentos con el encargo acordado.',
      'Separa lo que te han contado, lo que puedes contrastar y las decisiones que quedan fuera de tu encargo.',
      'Vincula cada observación con el documento que la respalda y señala lo que todavía falta confirmar.',
      'Resuelve dudas, contrasta el respaldo de tus recomendaciones y acuerda con el cliente qué actuaciones abordar primero.',
    ],
    checks: [
      {icon:'compass',title:'Qué vas a revisar',summary:'Objetivo y límites del encargo.',review:0},
      {icon:'users',title:'Quién decide',summary:'Cliente y otros profesionales.',review:0},
      {icon:'inventory',title:'Qué puedes contrastar',summary:'Documentos y observaciones.',review:1},
      {icon:'alert',title:'Qué falta confirmar',summary:'Declaraciones y dudas abiertas.',review:1},
    ],
    documentNotes:['Objetivo, límites y entregables del encargo.','Respaldo y dudas de cada observación.'],
    actions: [
      {title:'Pedir las aclaraciones',owner:'Consultoría + cliente',result:'Respuestas y documentación pendiente.'},
      {title:'Contrastar las observaciones',owner:'Equipo consultor',result:'Recomendaciones con evidencia vinculada.'},
      {title:'Acordar las prioridades',owner:'Consultoría + interlocutor del cliente',result:'Acciones propuestas, responsables y fechas.'},
    ],
  },
};

export function journeyChecks(scenario) {
  return JOURNEY_NARRATIVES[scenario.id].checks.map(check=>({
    ...check, text:scenario.review[check.review].text,
  }));
}
