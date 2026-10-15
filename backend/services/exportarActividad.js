"use strict";
const ExcelJS = require("exceljs");
const { listarActividad } = require("./consultaActividad");
const { ErrorOrganizacion, campos, fallo } = require("./datosOrganizacion");
const COLUMNAS = Object.freeze({
  fecha: "Fecha UTC",
  id: "ID evento",
  categoria: "Categoría",
  accion: "Acción",
  actorId: "ID usuario autor",
  membresiaActorId: "ID membresía autor",
  unidadId: "ID unidad",
  membresiaUnidadId: "ID pertenencia afectada",
  subespacioId: "ID subespacio",
  subespaciosRelacionados: "Subespacios relacionados",
  documentoId: "ID documento",
  contextoId: "ID contexto de empresa",
  operacionId: "ID operación",
  alcanceId: "ID alcance de evaluación",
  registroNormativoId: "ID registro normativo",
  decisionOperacionId: "ID decisión de operación",
  decisionId: "ID decisión de aplicabilidad",
  reglaId: "ID regla",
  antes: "Antes",
  despues: "Después",
});
const MAX_FILAS = 5000;
function preparar(query = {}) {
  const { formato = "csv", columnas, ...filtros } = query;
  // Paginar una exportación produciría un archivo parcial ambiguo.
  if (Object.hasOwn(filtros, "cursor") || Object.hasOwn(filtros, "limite"))
    fallo("DATOS_INVALIDOS");
  if (!["csv", "xlsx"].includes(formato)) fallo("DATOS_INVALIDOS");
  if (
    columnas !== undefined &&
    (typeof columnas !== "string" || columnas.length > 400)
  )
    fallo("DATOS_INVALIDOS");
  const elegidas =
    columnas === undefined ? Object.keys(COLUMNAS) : columnas.split(",");
  if (
    !elegidas.length ||
    elegidas.some((k) => !Object.hasOwn(COLUMNAS, k)) ||
    new Set(elegidas).size !== elegidas.length
  )
    fallo("DATOS_INVALIDOS");
  return { formato, elegidas, filtros };
}
function valor(v) {
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}
function csvCelda(v) {
  let s = valor(v);
  // CSV no conserva tipos. Evita que Excel interprete fórmulas, incluso tras espacios/control.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
async function generar(eventos, meta, formato, columnas) {
  if (formato === "csv") {
    const filas = [
      columnas.map((c) => csvCelda(COLUMNAS[c])).join(";"),
      ...eventos.map((e) => columnas.map((c) => csvCelda(e[c])).join(";")),
    ];
    return Buffer.from("\uFEFF" + filas.join("\r\n") + "\r\n", "utf8");
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "NormativaCheck";
  const hoja = wb.addWorksheet("Actividad");
  hoja.columns = columnas.map((c) => ({
    header: COLUMNAS[c],
    key: c,
    width: ["antes", "despues"].includes(c) ? 60 : 28,
  }));
  for (const e of eventos)
    hoja.addRow(Object.fromEntries(columnas.map((c) => [c, valor(e[c])])));
  // Siempre texto, nunca objetos formula/hyperlink procedentes de usuarios.
  hoja.getRow(1).font = { bold: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnas.length },
  };
  const contexto = wb.addWorksheet("Contexto");
  contexto.addRows([
    ["Organización", meta.organizacionId],
    ["Generado UTC", meta.horaServidor],
    ["Corte de consulta UTC", meta.corte],
    ["Filtros", JSON.stringify(meta.filtros)],
    ["Alcance", JSON.stringify(meta.alcance)],
    ["Filas", String(eventos.length)],
    [
      "Límites",
      "Exportación del historial registrado; no certificado ni instantánea transaccional entre páginas.",
    ],
  ]);
  contexto.getColumn(1).width = 28;
  contexto.getColumn(2).width = 100;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function crearExportador(listar = listarActividad) {
  return async function exportar(e) {
    const { formato, elegidas, filtros } = preparar(e.filtros);
    const inicio = Date.now(),
      eventos = [];
    let cursor, primera;
    do {
      if (Date.now() - inicio > 20000) fallo("SERVICIO_NO_DISPONIBLE");
      const r = await listar({
        ...e,
        filtros: { ...filtros, limite: "100", ...(cursor ? { cursor } : {}) },
      });
      primera ||= r;
      if (JSON.stringify(r.alcance) !== JSON.stringify(primera.alcance))
        fallo("RECURSO_NO_DISPONIBLE");
      eventos.push(...r.eventos);
      cursor = r.paginacion.siguienteCursor;
      if (
        eventos.length > MAX_FILAS ||
        (eventos.length === MAX_FILAS && cursor)
      ) {
        const error = new ErrorOrganizacion("DATOS_INVALIDOS");
        error.status = 422;
        error.codigo = "EXPORTACION_DEMASIADO_GRANDE";
        error.message =
          "La consulta supera 5000 eventos; acota las fechas antes de exportar.";
        throw error;
      }
    } while (cursor);
    const meta = {
      organizacionId: e.organizacionId,
      horaServidor: primera.horaServidor,
      corte: primera.paginacion.corte,
      filtros: primera.filtros,
      alcance: primera.alcance,
    };
    const contenido = await generar(eventos, meta, formato, elegidas);
    // La generación puede tardar: no enviar el archivo con un ámbito revocado.
    const final = await listar({
      ...e,
      filtros: { ...filtros, limite: "100" },
    });
    if (JSON.stringify(final.alcance) !== JSON.stringify(primera.alcance))
      fallo("RECURSO_NO_DISPONIBLE");
    return { contenido, formato, filas: eventos.length, corte: meta.corte };
  };
}
module.exports = {
  exportarActividad: crearExportador(),
  crearExportador,
  preparar,
  generar,
  csvCelda,
  COLUMNAS,
};
