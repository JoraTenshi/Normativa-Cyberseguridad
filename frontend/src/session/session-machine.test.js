import { createSessionMachine } from './session-machine';
const user = id => ({ id, email:id+'@example.invalid', nombre:id });
const response = (id='a', restanteMs=1800000) => ({ usuario:user(id), restanteMs, expiraEn:'2026-10-12T00:00:00Z' });
let wall, clock, transport, machine, publish;
beforeEach(() => { wall=1000; clock=1000; transport=jest.fn().mockResolvedValue(response()); publish=jest.fn(); machine=createSessionMachine(transport,{now:()=>wall,mono:()=>clock,publish}); });
test('empieza sin identidad aunque el navegador conserve un perfil falso', () => {
  localStorage.setItem('cyberaudit_user', JSON.stringify(user('falsa')));
  expect(machine.getSnapshot().user).toBeNull(); expect(machine.getSnapshot().phase).toBe('checking');
  expect(()=>machine.ticket()).toThrow();
});
test('recupera exclusivamente la identidad y límites del servidor',async()=>{
  await machine.sync(); expect(machine.getSnapshot().user.id).toBe('a'); expect(machine.getSnapshot().remainingMs).toBe(1800000);
});
test('un 401 inicial es anónimo, no credenciales ficticias',async()=>{
  transport.mockRejectedValue({status:401});await machine.sync();expect(machine.getSnapshot().phase).toBe('anonymous');
});
test('un 503 inicial permite reintentar sin inventar una sesión',async()=>{
  transport.mockRejectedValueOnce({status:503});await machine.sync();expect(machine.getSnapshot().phase).toBe('unavailable');
  await machine.sync();expect(machine.getSnapshot().phase).toBe('authenticated');
});
test('contrato malformado no autentica',async()=>{
  transport.mockResolvedValue({usuario:user('a'),restanteMs:Infinity});await machine.sync();expect(machine.getSnapshot().phase).toBe('unavailable');
});
test('latencia se descuenta de forma conservadora',async()=>{
  transport.mockImplementation(async()=>{wall+=200;clock+=200;return response();});
  await machine.sync();expect(machine.getSnapshot().remainingMs).toBe(1799800);
});
test('el contador no realiza peticiones ni registra actividad',async()=>{
  await machine.sync();transport.mockClear();wall+=1000;clock+=1000;machine.tick();
  expect(transport).not.toHaveBeenCalled();expect(machine.getSnapshot().remainingMs).toBe(1799000);
});
test('lecturas de sesión nunca se convierten en actividad',async()=>{
  await machine.sync();await machine.sync();expect(transport.mock.calls.every(c=>c[0]==='session')).toBe(true);
});
test('actividad se limita a una petición por minuto',async()=>{
  await machine.sync();await machine.activity();await machine.activity();
  expect(transport.mock.calls.filter(c=>c[0]==='activity')).toHaveLength(1);
  clock+=60000;wall+=60000;await machine.activity();expect(transport.mock.calls.filter(c=>c[0]==='activity')).toHaveLength(2);
});
test('la caducidad exacta bloquea y conserva identidad para reanudar',async()=>{
  transport.mockResolvedValue(response('a',1000));await machine.sync();clock+=1000;wall+=1000;machine.tick();
  expect(machine.getSnapshot().phase).toBe('locked');expect(machine.getSnapshot().user.id).toBe('a');expect(()=>machine.ticket()).toThrow();
});
test('suspensión del equipo se detecta aunque el reloj monotónico no avance',async()=>{
  await machine.sync();wall+=1800001;machine.tick();expect(machine.getSnapshot().phase).toBe('locked');
});
test('retroceder reloj del sistema no prolonga el contador',async()=>{
  await machine.sync();wall-=999999;clock+=1800001;machine.tick();expect(machine.getSnapshot().phase).toBe('locked');
});
test('una reautenticación con la misma cuenta conserva la clave del editor',async()=>{
  await machine.sync();const key=machine.getSnapshot().workspaceKey;machine.lock();await machine.signedIn();
  expect(machine.getSnapshot().workspaceKey).toBe(key);expect(publish).toHaveBeenCalledWith('session-changed');
});
test('otra cuenta cambia la clave y descarta el árbol anterior',async()=>{
  await machine.sync();const key=machine.getSnapshot().workspaceKey;machine.lock();transport.mockResolvedValue(response('b'));await machine.signedIn();
  expect(machine.getSnapshot().workspaceKey).toBe(key+1);expect(machine.getSnapshot().user.id).toBe('b');
});
test('logout espera confirmación y descarta la identidad solo al tener éxito',async()=>{
  await machine.sync();const ok=await machine.logout();expect(ok).toBe(true);expect(machine.getSnapshot().user).toBeNull();expect(publish).toHaveBeenCalledWith('signed-out');
});
test('logout fallido no simula cierre ni destruye el borrador',async()=>{
  await machine.sync();const key=machine.getSnapshot().workspaceKey;transport.mockRejectedValueOnce({status:503});
  expect(await machine.logout()).toBe(false);expect(machine.getSnapshot().phase).toBe('locked');
  expect(machine.getSnapshot().workspaceKey).toBe(key);expect(machine.getSnapshot().user.id).toBe('a');expect(publish).not.toHaveBeenCalled();
});
test('respuesta GET tardía no revive una sesión cerrada',async()=>{
  await machine.sync();let resolve;transport.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const pending=machine.sync();await machine.logout();resolve(response());await pending;expect(machine.getSnapshot().phase).toBe('anonymous');
});
test('respuesta anterior a reautenticación se descarta',async()=>{
  await machine.sync();const ticket=machine.ticket();machine.lock();await machine.signedIn();expect(()=>machine.accept(ticket,200)).toThrow('anterior');
});
test('una respuesta 403 no equivale a sesión caducada',async()=>{
  await machine.sync();expect(()=>machine.accept(machine.ticket(),403)).not.toThrow();expect(machine.getSnapshot().phase).toBe('authenticated');
});
test('un 401 de recurso bloquea sin cambiar la clave del borrador',async()=>{
  await machine.sync();expect(()=>machine.accept(machine.ticket(),401)).toThrow();expect(machine.getSnapshot().phase).toBe('locked');
});
test('el servidor detecta cambio de cuenta aunque responda 409',async()=>{
  await machine.sync();expect(()=>machine.accept(machine.ticket(),409,'CUENTA_CAMBIADA')).toThrow();expect(machine.getSnapshot().phase).toBe('locked');
});

test('foco, bloqueo de pestaña y sync no cancelan un cierre ya enviado',async()=>{
  await machine.sync();let resolve;transport.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const closing=machine.logout();machine.lock('Pestaña oculta');expect(await machine.sync()).toBe(false);
  expect(await machine.signedIn()).toBe(false);expect(machine.getSnapshot().phase).toBe('closing');
  resolve({});expect(await closing).toBe(true);expect(machine.getSnapshot().phase).toBe('anonymous');
});
test('una respuesta tardía se trata como incierta, no como conflicto confirmado',async()=>{
  await machine.sync();const ticket=machine.ticket();machine.lock();await machine.signedIn();
  try{machine.accept(ticket,201);throw Error('No rechazó');}catch(e){expect(e.status).toBe(0);expect(e.code).toBe('RESPUESTA_ANTIGUA');}
});
