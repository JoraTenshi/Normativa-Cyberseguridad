"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { datos: datosSub } = require("../services/subespacios");
const {
  datos: datosDoc,
  comprobarPdf,
  MAX_PDF,
} = require("../services/documentosOrganizacion");
const { validarFiltros } = require("../services/consultaActividad");
const {
  crearExportador,
  preparar,
  generar,
  csvCelda,
} = require("../services/exportarActividad");
const E = require("../models/EventoOrganizacion");
const S = require("../models/Subespacio"),
  D = require("../models/DocumentoOrganizacion"),
  V = require("../models/VersionDocumento");
const { id, version, clave } = require("../services/datosOrganizacion");
const O = "100000000000000000000001",
  U = "200000000000000000000001",
  M = "300000000000000000000001",
  SUB = "400000000000000000000001";
test("subespacio valida servicio/producto y rechaza campos de autorización", () => {
  assert.deepEqual(
    datosSub(
      { nombre: " SaaS ", tipo: "producto", descripcion: " Reservas " },
      true,
    ),
    { nombre: "SaaS", descripcion: "Reservas", tipo: "producto" },
  );
  for (const datos of [
    { nombre: "x" },
    { nombre: "x", tipo: "departamento", descripcion: "x" },
    { nombre: "x", tipo: "servicio", descripcion: "x", organizacion: O },
    { nombre: { $ne: "" } },
  ]) {
    assert.throws(() => datosSub(datos, true), { codigo: "DATOS_INVALIDOS" });
  }
});
for (const valor of [null, [], {}, { $ne: null }, "x", 123]) {
  test("identificador estricto rechaza " + JSON.stringify(valor), () =>
    assert.throws(() => id(valor), { codigo: "DATOS_INVALIDOS" }),
  );
}
for (const valor of [-1, 1.5, "1", null, Number.MAX_SAFE_INTEGER]) {
  test("versión rechaza " + JSON.stringify(valor), () =>
    assert.throws(() => version(valor), { codigo: "DATOS_INVALIDOS" }),
  );
}
test("claves de reintento acotadas", () => {
  assert.equal(clave("a".repeat(16)), "a".repeat(16));
  for (const v of [null, "corta", "a".repeat(101), "a b".repeat(10)])
    assert.throws(() => clave(v));
});
test("metadatos documentales privados por defecto; no aceptan concesiones implícitas", () => {
  const d = datosDoc(
    { titulo: " Política ", categoriaDocumental: "legal" },
    true,
  );
  assert.deepEqual(d.lectores, []);
  assert.deepEqual(d.unidades_lectoras, []);
  assert.deepEqual(d.vinculos, []);
  for (const x of [
    { titulo: "x", categoriaDocumental: "legal", publico: true },
    { titulo: "x", categoriaDocumental: "legal", lectores: [M, M] },
    { titulo: "x", categoriaDocumental: "legal", lectores: [{ $ne: null }] },
    {
      titulo: "x",
      categoriaDocumental: "legal",
      vinculos: [{ subespacioId: SUB, motivo: "" }],
    },
  ]) {
    assert.throws(() => datosDoc(x, true), { codigo: "DATOS_INVALIDOS" });
  }
});
const pdf = Buffer.from(
  "%PDF-1.7\nBytes sinteticos para validar limites\n%%EOF\n",
);
test("valida PDF por firma/tamaño/extensión sin afirmar antivirus", () => {
  const r = comprobarPdf(pdf, "Política.pdf");
  assert.match(r.sha256, /^[a-f0-9]{64}$/);
  for (const [b, n] of [
    [Buffer.from("Hola"), "x.pdf"],
    [pdf, "x.docx"],
    [pdf, "../x.pdf"],
    [pdf, "x\t.pdf"],
    [pdf, "x\n.pdf"],
    [Buffer.alloc(MAX_PDF + 1), "x.pdf"],
  ]) {
    assert.throws(() => comprobarPdf(b, n));
  }
});
test("modelos declaran índices únicos de creación, reintento y versión", () => {
  for (const [modelo, nombre] of [
    [S, "subespacio_creacion_unica"],
    [D, "documento_creacion_unica"],
    [V, "documento_version_unica"],
    [V, "documento_reintento_unico"],
  ]) {
    assert.ok(
      modelo.schema
        .indexes()
        .some(([, o]) => o.name === nombre && o.unique === true),
    );
  }
});
test("nuevas familias de eventos no inventan unidad; exigen referencia correcta", async () => {
  const base = {
    organizacion: O,
    actor: U,
    membresia_actor: M,
    despues: { version: 0 },
  };
  assert.ok(
    new E({ ...base, accion: "unidad_creada" }).validateSync().errors.unidad,
  );
  assert.ok(
    new E({ ...base, accion: "subespacio_creado" }).validateSync().errors
      .subespacio,
  );
  assert.ok(
    new E({ ...base, accion: "documento_creado" }).validateSync().errors
      .documento,
  );
  await new E({
    ...base,
    accion: "subespacio_creado",
    subespacio: SUB,
  }).validate();
  await assert.rejects(
    new E({
      ...base,
      accion: "subespacio_creado",
      subespacio: SUB,
      unidad: SUB,
    }).validate(),
  );
});
test("filtra nuevas categorías y referencias sin aceptar operadores", () => {
  const f = validarFiltros({
    subespacioId: SUB,
    documentoId: SUB,
    categoria: "documentos",
  });
  assert.equal(f.subespacioId, SUB);
  assert.equal(f.categoria, "documentos");
  assert.throws(() =>
    validarFiltros({ categoria: "subespacios", accion: "documento_creado" }),
  );
  assert.throws(() => validarFiltros({ subespacioId: { $ne: null } }));
});
test("selección de columnas acotada y exportación nunca acepta cursor/limite parcial", () => {
  assert.deepEqual(
    preparar({ formato: "xlsx", columnas: "fecha,accion" }).elegidas,
    ["fecha", "accion"],
  );
  for (const q of [
    { columnas: "fecha,password" },
    { columnas: "fecha,fecha" },
    { columnas: "" },
    { formato: "exe" },
    { cursor: "x" },
    { limite: "10" },
    { columnas: ["fecha"] },
  ]) {
    assert.throws(() => preparar(q), { codigo: "DATOS_INVALIDOS" });
  }
});
for (const texto of [
  "=1+1",
  "+SUM(A1)",
  "-1+1",
  "@SUM(A1)",
  " \t=2",
  "\ttexto",
]) {
  test("CSV neutraliza fórmula " + JSON.stringify(texto), () =>
    assert.ok(csvCelda(texto).startsWith("\"'")),
  );
}
test("XLSX conserva texto peligroso como texto y aplica filtro/hoja de contexto", async () => {
  const b = await generar(
    [{ accion: "=1+1", antes: { titulo: "@hola" } }],
    {
      organizacionId: O,
      horaServidor: "2026-10-08T00:00:00Z",
      corte: "2026-10-08T00:00:00Z",
      filtros: {},
      alcance: {},
    },
    "xlsx",
    ["accion", "antes"],
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(b);
  const hoja = wb.getWorksheet("Actividad");
  assert.equal(hoja.getCell("A2").value, "=1+1");
  assert.equal(hoja.getCell("A2").formula, undefined);
  assert.ok(hoja.autoFilter);
  assert.ok(wb.getWorksheet("Contexto"));
});
test("exportador rechaza más de5000 en lugar de truncar y aparentar historial completo", async () => {
  let n = 0;
  const exportar = crearExportador(async () => ({
    eventos: Array(100).fill({ id: String(++n) }),
    paginacion: { siguienteCursor: "otro", corte: "2026-10-08T00:00:00Z" },
    alcance: { tipo: "organizacion" },
    filtros: {},
    horaServidor: "2026-10-08T00:00:00Z",
  }));
  await assert.rejects(exportar({ organizacionId: O, filtros: {} }), {
    codigo: "EXPORTACION_DEMASIADO_GRANDE",
    status: 422,
  });
});
test("exportador revalida acceso después de generar; no envía contenido revocado", async () => {
  let n = 0;
  const exportar = crearExportador(async () => {
    if (++n > 1)
      throw Object.assign(new Error("revocado"), {
        codigo: "ACCESO_ORGANIZACION_DENEGADO",
      });
    return {
      eventos: [],
      paginacion: { siguienteCursor: null, corte: "2026-10-08T00:00:00Z" },
      alcance: { tipo: "organizacion" },
      filtros: {},
      horaServidor: "2026-10-08T00:00:00Z",
    };
  });
  await assert.rejects(exportar({ organizacionId: O, filtros: {} }), {
    codigo: "ACCESO_ORGANIZACION_DENEGADO",
  });
});
