/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React from 'react';
export const DEMO_ENTRIES = {
  fundamento: { title:'Entender por qué hay una tarea', hint:'En el detalle está abierto «Fundamento». Lee el motivo y la referencia; después puedes abrir el documento relacionado.', section:'tasks', panel:'basis' },
  documento: { title:'Revisar el documento', hint:'Lee el anexo de Trama y sus observaciones. Al cerrarlo vuelves a la tarea que explica qué falta preparar.', section:'tasks', panel:'work', modal:'sample' },
  tarea: { title:'Organizar el siguiente paso', hint:'En el detalle puedes cambiar el estado y la persona responsable. Después consulta «Histórico de tareas» para ver el cambio.', section:'tasks', panel:'work' },
};
export const DEMO_ROUTES = {
  ...DEMO_ENTRIES,
  soporte: { title:'Aclarar las responsabilidades del soporte', hint:'Revisa qué acceso necesita el mantenimiento y qué información falta antes de concretar las condiciones con el cliente.', section:'tasks', panel:'basis', scope:'medida', task:'encargo' },
  medidas: { title:'Preparar evidencias de seguridad', hint:'Consulta la revisión de permisos de Trama y la matriz preparada. Comprueba qué sigue pendiente antes de presentar ese trabajo a un cliente.', section:'tasks', panel:'work', scope:'saas', task:'permisos' },
  continuidad: { title:'Comprobar la recuperación del servicio', hint:'Esta tarea reúne los pasos para probar una restauración y registrar el resultado.', section:'tasks', panel:'basis', scope:'saas', task:'restauracion' },
  contrato: { title:'Revisar el compromiso con tu cliente', hint:'Contrasta las condiciones de disponibilidad con la versión aceptada del acuerdo y su trabajo pendiente.', section:'tasks', panel:'basis', scope:'saas', task:'contrato' },
};
export function DemoChoices({compact=false}) {
  return <div className={compact?'demo-choices compact':'demo-choices'}>{Object.entries(DEMO_ENTRIES).map(([id,entry],i)=><a key={id} href={'#/demo/'+id}><span className="choice-number">{'0'+(i+1)}</span><strong>{entry.title}</strong><span className="choice-description">{['El motivo, la referencia y la actuación.','Qué contiene y qué falta por concretar.','Responsable, estado e histórico.'][i]}</span><span className="choice-arrow" aria-hidden="true">↗</span></a>)}</div>;
}
export function TrySection() {
  return <section className="try-section" id="prueba"><div className="section-shell"><div className="try-heading"><h2>Entra por donde<br/><em>te resulte más útil.</em></h2><p>Abre una tarea, consulta su documento o sigue el trabajo. Tú eliges.</p></div><DemoChoices/></div></section>;
}
