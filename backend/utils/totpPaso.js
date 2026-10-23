'use strict';
// Un código TOTP solo vale una vez (RFC 6238 §5.2). Cada código pertenece a un intervalo ("paso") de
// 30 s; se guarda el último paso aceptado de cada usuario (twoFactorLastStep) y solo se acepta un código
// de un paso posterior. El consumo es una actualización condicional en MongoDB, así que dos peticiones
// simultáneas con el mismo código no pueden aceptarse las dos.
const speakeasy = require('speakeasy');

const PERIODO_S = 30;

// Paso del código si es válido en la ventana de ±1 intervalo; null si no lo es.
function pasoDelCodigo(secret, token, ahoraMs = Date.now()) {
  if (typeof token !== 'string') return null;
  const segundos = Math.floor(ahoraMs / 1000);
  const r = speakeasy.totp.verifyDelta({ secret, encoding: 'base32', token, window: 1, step: PERIODO_S, time: segundos });
  return r ? Math.floor(segundos / PERIODO_S) + r.delta : null;
}

// Consume el paso para el usuario: true si era posterior al último aceptado (y queda registrado).
async function consumirPaso(Usuario, filtro, paso) {
  const r = await Usuario.updateOne(
    { ...filtro, $or: [{ twoFactorLastStep: null }, { twoFactorLastStep: { $lt: paso } }] },
    { $set: { twoFactorLastStep: paso } }
  );
  return r.matchedCount === 1;
}

const MENSAJE_CODIGO_USADO = 'Ese código ya se ha utilizado; espera al siguiente';

module.exports = { pasoDelCodigo, consumirPaso, MENSAJE_CODIGO_USADO, PERIODO_S };
