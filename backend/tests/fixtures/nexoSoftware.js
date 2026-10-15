'use strict';
// Exclusivamente tests y runner temporal. No alta en la BD habitual ni emails.
const conocido = (clave, valor) => ({ clave, estado: 'conocido', valor });
const desconocido = clave => ({ clave, estado: 'desconocido', motivo: 'por_consultar' });
function empresa() {
  const hechos = [conocido('pais_establecimiento', 'ES'), conocido('plantilla', 8),
    conocido('mercados', ['ES', 'UE']), conocido('clientes', ['empresas']), conocido('publico_directo', false),
    desconocido('cadena_publica'), desconocido('voluntario_ens'), desconocido('voluntario_iso'),
    conocido('perfil_actividades', ['web', 'producto', 'saas'])];
  const a = (s, k, v) => hechos.push(v === undefined ? desconocido('actividad_' + s + '_' + k) : conocido('actividad_' + s + '_' + k, v));
  for (const [s, nombre, tipo, funciones] of [
    ['web', 'Desarrollo web', 'servicio', ['desarrollo', 'mantenimiento']],
    ['producto', 'Gestor documental descargable', 'producto', ['desarrollo', 'distribucion']],
    ['saas', 'Análisis documental SaaS', 'servicio', ['alojamiento', 'operacion']]
  ]) { a(s, 'nombre', nombre); a(s, 'tipo', tipo); a(s, 'funciones', funciones); }
  a('web', 'datos_terceros'); a('web', 'sistemas_terceros', true);
  a('producto', 'descargable', true); a('producto', 'marca_propia', true);
  a('saas', 'usa_ia', true); a('saas', 'datos_terceros', true); a('saas', 'por_cuenta_cliente', true);
  return { hechos, motivo: 'Nexo Software DEMO: todos los datos son sintéticos' };
}
function confirmacion(p) {
  return { contextoVersion: p.contextoVersion, propuestaHuella: p.propuestaHuella, confirmar: true,
    espacios: p.espacios.map(e => ({ actividadId: e.actividadId, nuevo: { nombre: e.nombre, tipo: e.tipo, descripcion: e.descripcion } })),
    alcances: p.alcances.map(({ estado, ...a }) => a), motivo: 'Confirmación organizativa sintética, no jurídica' };
}
module.exports = { empresa, confirmacion, conocido, desconocido };
