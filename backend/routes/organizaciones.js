"use strict";
const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/auth");
const {
  listarActividad,
  ErrorActividad,
} = require("../services/consultaActividad");
const { exportarActividad } = require("../services/exportarActividad");
const {
  obtenerContextoOrganizacion,
  ErrorContextoOrganizacion,
} = require("../services/contextoOrganizacion");
const {
  ErrorOrganizacion,
  campos,
  fallo,
} = require("../services/datosOrganizacion");
const sub = require("../services/subespacios");
const doc = require("../services/documentosOrganizacion");
const router = express.Router();
function entrada(req) {
  return {
    usuarioId: req.user.id,
    organizacionId: req.params.organizacionId,
    subespacioId: req.params.subespacioId,
    documentoId: req.params.documentoId,
  };
}
function error(res, e) {
  if (
    e instanceof ErrorOrganizacion ||
    e instanceof ErrorActividad ||
    e instanceof ErrorContextoOrganizacion
  ) {
    return res
      .status(e.status)
      .json({ ok: false, codigo: e.codigo, error: e.message });
  }
  if (e.type === "entity.too.large")
    return res
      .status(413)
      .json({
        ok: false,
        codigo: "PDF_DEMASIADO_GRANDE",
        error: "Máximo 5 MiB por PDF",
      });
  return res
    .status(503)
    .json({
      ok: false,
      codigo: "SERVICIO_NO_DISPONIBLE",
      error: "Servicio no disponible temporalmente",
    });
}
const ejecutar = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    error(res, e);
  }
};
router.use("/:organizacionId", requireAuth, (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Cookie");
  next();
});
router.get(
  "/:organizacionId/actividad",
  ejecutar(async (req, res) => {
    res.json({
      ok: true,
      data: await listarActividad({ ...entrada(req), filtros: req.query }),
    });
  }),
);
const exportLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: "LIMITE_EXPORTACIONES",
    error: "Espera un minuto antes de volver a exportar",
  },
});
router.get(
  "/:organizacionId/actividad/exportar",
  exportLimiter,
  ejecutar(async (req, res) => {
    const r = await exportarActividad({ ...entrada(req), filtros: req.query });
    res.set(
      "Content-Disposition",
      'attachment; filename="actividad.' + r.formato + '"',
    );
    res.set("X-Export-Rows", String(r.filas));
    res.set("X-Export-Cutoff", r.corte);
    res.type(
      r.formato === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(r.contenido);
  }),
);
router.get(
  "/:organizacionId/subespacios",
  ejecutar(async (req, res) => {
    res.json({
      ok: true,
      data: await sub.listarSubespacios({
        ...entrada(req),
        filtros: req.query,
      }),
    });
  }),
);
router.get(
  "/:organizacionId/subespacios/:subespacioId",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    res.json({ ok: true, data: await sub.obtenerSubespacio(entrada(req)) });
  }),
);
router.post(
  "/:organizacionId/subespacios",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    res
      .status(201)
      .json({
        ok: true,
        data: await sub.crearSubespacio({
          ...entrada(req),
          datos: req.body,
          clave: req.get("Idempotency-Key"),
        }),
      });
  }),
);
router.patch(
  "/:organizacionId/subespacios/:subespacioId",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    campos(req.body, ["version", "datos"]);
    res.json({
      ok: true,
      data: await sub.modificarSubespacio({
        ...entrada(req),
        accion: "actualizar",
        version: req.body.version,
        datos: req.body.datos,
      }),
    });
  }),
);
for (const accion of ["archivar", "restaurar"]) {
  router.post(
    "/:organizacionId/subespacios/:subespacioId/" + accion,
    ejecutar(async (req, res) => {
      campos(req.query, []);
      campos(req.body, ["version"]);
      res.json({
        ok: true,
        data: await sub.modificarSubespacio({
          ...entrada(req),
          accion,
          version: req.body.version,
        }),
      });
    }),
  );
}
router.get(
  "/:organizacionId/documentos",
  ejecutar(async (req, res) => {
    res.json({
      ok: true,
      data: await doc.listarDocumentos({ ...entrada(req), filtros: req.query }),
    });
  }),
);
router.get(
  "/:organizacionId/documentos/:documentoId",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    res.json({ ok: true, data: await doc.obtenerDocumento(entrada(req)) });
  }),
);
router.post(
  "/:organizacionId/documentos",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    res
      .status(201)
      .json({
        ok: true,
        data: await doc.crearDocumento({
          ...entrada(req),
          datos: req.body,
          clave: req.get("Idempotency-Key"),
        }),
      });
  }),
);
router.patch(
  "/:organizacionId/documentos/:documentoId",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    campos(req.body, ["version", "datos"]);
    res.json({
      ok: true,
      data: await doc.modificarDocumento({
        ...entrada(req),
        accion: "actualizar",
        version: req.body.version,
        datos: req.body.datos,
      }),
    });
  }),
);
for (const accion of ["archivar", "restaurar"]) {
  router.post(
    "/:organizacionId/documentos/:documentoId/" + accion,
    ejecutar(async (req, res) => {
      campos(req.query, []);
      campos(req.body, ["version"]);
      res.json({
        ok: true,
        data: await doc.modificarDocumento({
          ...entrada(req),
          accion,
          version: req.body.version,
        }),
      });
    }),
  );
}
router.get(
  "/:organizacionId/documentos/:documentoId/versiones",
  ejecutar(async (req, res) => {
    res.json({
      ok: true,
      data: await doc.versionesDocumento({
        ...entrada(req),
        filtros: req.query,
      }),
    });
  }),
);
// Autorizar ANTES de reservar memoria para el PDF. El servicio vuelve a comprobar
// dentro de la transacción para detectar una revocación entre ambos momentos.
async function adminAntesDePdf(req, res, next) {
  try {
    const c = await obtenerContextoOrganizacion(entrada(req));
    if (c.rol !== "administrador") fallo("GESTION_DENEGADA");
    if (!req.is("application/pdf"))
      return res
        .status(415)
        .json({
          ok: false,
          codigo: "TIPO_NO_ADMITIDO",
          error: "Solo application/pdf",
        });
    next();
  } catch (e) {
    error(res, e);
  }
}
router.post(
  "/:organizacionId/documentos/:documentoId/versiones",
  adminAntesDePdf,
  express.raw({ type: "application/pdf", limit: doc.MAX_PDF, inflate: false }),
  ejecutar(async (req, res) => {
    campos(req.query, ["nombre", "version"]);
    if (
      typeof req.query.version !== "string" ||
      !/^\d{1,9}$/.test(req.query.version)
    )
      fallo("DATOS_INVALIDOS");
    res
      .status(201)
      .json({
        ok: true,
        data: await doc.subirVersion({
          ...entrada(req),
          nombre: req.query.nombre,
          version: Number(req.query.version),
          contenido: req.body,
          clave: req.get("Idempotency-Key"),
        }),
      });
  }),
);
router.get(
  "/:organizacionId/documentos/:documentoId/versiones/:numero/archivo",
  ejecutar(async (req, res) => {
    campos(req.query, []);
    const r = await doc.descargarVersion({
      ...entrada(req),
      numero: req.params.numero,
    });
    res.set(
      "Content-Disposition",
      "attachment; filename=\"documento.pdf\"; filename*=UTF-8''" +
        encodeURIComponent(r.nombre),
    );
    res.set("X-Document-SHA256", r.sha256);
    res.type("application/pdf").send(r.contenido);
  }),
);
router.use("/:organizacionId", require("./alcancesEvaluacion"));
router.use("/:organizacionId/contexto", require("./contextoEmpresa"));
router.use("/:organizacionId/normativa", require("./registrosNormativos"));
router.use("/:organizacionId/operaciones", require("./operaciones"));
router.use((e, req, res, next) => error(res, e));
module.exports = router;
