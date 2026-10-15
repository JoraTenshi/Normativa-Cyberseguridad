import { answerDraft, parseAnswer, contextWrite, conflictingKeys, rebaseEdits, newActivity, materializationBody } from './profile-model';
const known = (clave, valor) => ({ clave, estado: 'conocido', valor });
const q = tipo => ({ clave: 'dato', tipo });
const answer = raw => ({ state: 'conocido', raw });
const proposal = () => ({ contextoVersion: 2, propuestaHuella: 'a'.repeat(64),
  espacios: [{ actividadId: 'web', nombre: 'Portal', tipo: 'servicio', descripcion: 'Espacio Portal' }],
  alcances: [{ clave: 'web', nombre: 'Portal', actividadIds: ['web'], sistemas: [], informacion: [], limites: '', exclusiones: [], dependencias: [], estado: 'preliminar' }] });

test('lo ausente queda desconocido; no false ni cero', () => {
  const d = answerDraft(q('booleano'));
  expect(parseAnswer(q('booleano'), d)).toEqual({ clave: 'dato', estado: 'desconocido', motivo: 'no_aportado' });
  expect(() => parseAnswer(q('numero'), answer(''))).toThrow();
  expect(() => parseAnswer(q('booleano'), answer(''))).toThrow();
});
test('booleanos tipados y número cero explícito', () => {
  expect(parseAnswer(q('booleano'), answer('false')).valor).toBe(false);
  expect(parseAnswer(q('numero'), answer('0')).valor).toBe(0);
  for (const raw of ['1.5', '-1', '1000001', 'abc']) expect(() => parseAnswer(q('numero'), answer(raw))).toThrow();
});
test('listas mantienen los tipos y rechazan repetidos y límites', () => {
  expect(parseAnswer(q('lista'), answer(' ES ; UE ')).valor).toEqual(['ES','UE']);
  expect(() => parseAnswer(q('lista'), answer('ES; ES'))).toThrow();
  expect(() => parseAnswer(q('lista'), answer(Array.from({length:21},(_,i)=>'x'+i).join(';')))).toThrow();
  expect(() => parseAnswer(q('ids'), answer('otro'))).toThrow();
  expect(() => parseAnswer(q('funciones'), answer('inventada'))).toThrow();
});
test('servicio/producto y texto son explícitos y acotados', () => {
  expect(() => parseAnswer(q('tipo'), answer(''))).toThrow();
  expect(() => parseAnswer(q('texto'), answer(' '.repeat(20)))).toThrow();
  expect(() => parseAnswer(q('texto'), answer('x'.repeat(121)))).toThrow();
  expect(() => parseAnswer(q('desconocido'), answer('x'))).toThrow();
});
test('se conserva la contradicción sin decidir por la persona', () => {
  const original = {clave:'dato',estado:'conflictivo',alternativas:[{valor:true},{valor:false}]};
  expect(parseAnswer(q('booleano'), answerDraft({ ...q('booleano'), respuesta:original }))).toEqual(original);
});
test('guardar solo envía cambios intencionales, no preguntas ocultas', () => {
  const before = [known('a',1), known('contrato_oculto','x')];
  expect(contextWrite(3,before,[known('a',2)],' Motivo ')).toEqual({version:3,cambios:[known('a',2)],motivo:'Motivo'});
  expect(() => contextWrite(3,before,[known('a',1)],'Motivo')).toThrow();
  expect(() => contextWrite(3,before,[known('a',2)],' ')).toThrow();
});
test('no divide silenciosamente un guardado de más de 50 datos', () => {
  expect(() => contextWrite(1,[],Array.from({length:51},(_,i)=>known('x'+i,true)),'motivo')).toThrow(/50/);
});
test('comparar detecta solo cambios concurrentes sobre el mismo dato', () => {
  const before=[known('a',1),known('b',1)], mine=[known('a',2)], server=[known('a',3),known('b',2)];
  expect(conflictingKeys(before,mine,server)).toEqual(['a']);
  expect(() => rebaseEdits(before,mine,server,{})).toThrow();
  expect(rebaseEdits(before,mine,server,{a:'mine'})).toEqual(mine);
  expect(rebaseEdits(before,mine,server,{a:'server'})).toEqual([]);
});
test('rebase no sobrescribe campos remotos no editados', () => {
  const before=[known('a',1),known('b',1)], server=[known('a',1),known('b',2)];
  expect(rebaseEdits(before,[known('a',2)],server,{})).toEqual([known('a',2)]);
  expect(rebaseEdits(before,[known('a',2)],[known('a',2)],{})).toEqual([]);
});
test('una actividad nueva no reutiliza identificadores retirados', () => {
  const changes=newActivity([known('actividad_act1_nombre','Vieja')],[], 'Web','servicio');
  expect(changes[0].valor).toEqual(['act2']);
  expect(changes[1]).toEqual(known('actividad_act2_nombre','Web'));
  expect(() => newActivity([],Array.from({length:8},(_,i)=>'a'+i),'Web','servicio')).toThrow();
});
test('materializar requiere confirmación, motivo y tipo; no copia estado de lectura', () => {
  expect(() => materializationBody(proposal(),{},'motivo',false)).toThrow();
  expect(() => materializationBody(proposal(),{},'',true)).toThrow();
  const p=proposal();p.espacios[0].tipo=null;
  expect(() => materializationBody(p,{},'motivo',true)).toThrow();
  const body=materializationBody(proposal(),{},'motivo',true);
  expect(body.alcances[0].estado).toBeUndefined();expect(body.contextoVersion).toBe(2);
  expect(body.propuestaHuella).toBe('a'.repeat(64));
  expect(body.espacios[0].nuevo.tipo).toBe('servicio');
});
test('reutilizar espacio respeta versión cero sin crear otro', () => {
  const s={id:'a'.repeat(24),version:0};
  const body=materializationBody(proposal(),{web:s},'motivo',true);
  expect(body.espacios[0]).toEqual({actividadId:'web',existente:s});
  expect(() => materializationBody(proposal(),{web:{...s,version:-1}},'motivo',true)).toThrow();
});
