// Both HTTP clients use this bridge; it carries no token.
let machine = null;
export function bindSession(value) { machine = value; return () => { if (machine === value) machine = null; }; }
export function sessionTicket() {
  if (!machine) throw Object.assign(new Error('Comprobando sesión'), { status:401 });
  return machine.ticket();
}
export function acceptSessionResponse(ticket, status, code) {
  if (!machine) throw Object.assign(new Error('Sesión no disponible'), { status:401 });
  return machine.accept(ticket, status, code);
}
