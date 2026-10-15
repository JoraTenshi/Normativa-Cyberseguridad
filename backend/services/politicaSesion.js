'use strict';

// Bloque 1: política pura, todavía NO conectada al middleware de autenticación.
// Las fechas las fija el servidor. Nunca recibir "ahora" o actividad desde req.body.
const VERSION_POLITICA = 1;
const DURACION_MAXIMA_MS = 8 * 60 * 60 * 1000;
const INACTIVIDAD_MAXIMA_MS = 30 * 60 * 1000;

function fechaValida(valor) {
  return valor instanceof Date && Number.isFinite(valor.getTime());
}

function crearEstadoSesion({ ahora = new Date(), mantenerSesion = false } = {}) {
  if (!fechaValida(ahora)) throw new TypeError('El reloj del servidor debe producir una fecha válida');
  if (typeof mantenerSesion !== 'boolean') throw new TypeError('mantenerSesion debe ser booleano');
  return {
    versionPolitica: VERSION_POLITICA,
    autenticadaEn: new Date(ahora.getTime()),
    ultimaActividadEn: new Date(ahora.getTime()),
    expiraEn: new Date(ahora.getTime() + DURACION_MAXIMA_MS),
    mantenerSesion,
    revocadaEn: null
  };
}

// Solo evalúa tiempo/revocación. NO verifica JWT, identidad, MFA ni permisos.
// Que un registro siga en Mongo tampoco lo convierte en una sesión vigente.
function evaluarVigencia(sesion, ahora = new Date()) {
  const denegar = codigo => ({ valida: false, codigo });
  if (!sesion || typeof sesion !== 'object' || Array.isArray(sesion) ||
      !fechaValida(ahora) || sesion.versionPolitica !== VERSION_POLITICA ||
      typeof sesion.mantenerSesion !== 'boolean' ||
      !fechaValida(sesion.autenticadaEn) || !fechaValida(sesion.ultimaActividadEn) ||
      !fechaValida(sesion.expiraEn)) return denegar('SESION_DATOS_INVALIDOS');

  const inicio = sesion.autenticadaEn.getTime();
  const actividad = sesion.ultimaActividadEn.getTime();
  const absoluta = inicio + DURACION_MAXIMA_MS;
  const actual = ahora.getTime();
  if (sesion.expiraEn.getTime() !== absoluta ||
      actividad < inicio || actividad >= absoluta || actual < actividad) {
    return denegar('SESION_DATOS_INVALIDOS');
  }
  if (sesion.revocadaEn !== null) {
    if (!fechaValida(sesion.revocadaEn) ||
        sesion.revocadaEn.getTime() < inicio || sesion.revocadaEn.getTime() > actual) {
      return denegar('SESION_DATOS_INVALIDOS');
    }
    return denegar('SESION_REVOCADA');
  }
  if (actual >= absoluta) return denegar('SESION_LIMITE_ABSOLUTO');
  const inactiva = actividad + INACTIVIDAD_MAXIMA_MS;
  if (actual >= inactiva) return denegar('SESION_INACTIVA');
  const efectiva = Math.min(absoluta, inactiva);
  return {
    valida: true,
    codigo: 'SESION_VIGENTE',
    expiraEn: new Date(absoluta),
    inactivaEn: new Date(inactiva),
    limiteEfectivoEn: new Date(efectiva),
    restanteMs: efectiva - actual
  };
}

// Prepara datos; NO los persiste. El siguiente bloque deberá comprobar/actualizar
// atómicamente la sesión para no reactivar una caducada o revocada entre peticiones.
// Solo actividad admitida por el servidor; sondeos, reloj y comprobaciones de
// estado no deben llamar a esta función por el mero hecho de recibir una petición.
function prepararActividad(sesion, ahora = new Date()) {
  const estado = evaluarVigencia(sesion, ahora);
  if (!estado.valida) return { permitida: false, codigo: estado.codigo };
  return {
    permitida: true,
    codigo: estado.codigo,
    cambios: { ultimaActividadEn: new Date(ahora.getTime()) }
  };
}

module.exports = {
  VERSION_POLITICA, DURACION_MAXIMA_MS, INACTIVIDAD_MAXIMA_MS,
  crearEstadoSesion, evaluarVigencia, prepararActividad
};
