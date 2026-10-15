"use strict";
// Solo HTTP/DB temporal del ejecutor. No .env, datos reales ni Docker.
const crypto = require("node:crypto");
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.APP_URL = "https://localhost";
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const ExcelJS = require("exceljs");
const O = require("../models/Organizacion"),
  M = require("../models/Membresia");
const U = require("../models/UnidadTrabajo"),
  P = require("../models/MembresiaUnidad");
const S = require("../models/Subespacio"),
  D = require("../models/DocumentoOrganizacion");
const V = require("../models/VersionDocumento"),
  E = require("../models/EventoOrganizacion");
const Usuario = require("../models/Usuario"),
  Revoked = require("../models/RevokedToken");
const { createApp } = require("../app");
async function comprobar({ uri, nombreBD, standalone = false }) {
  const url = new URL(uri);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port === "27017" ||
    !/^nc_org03_[a-f0-9]{24}$/.test(nombreBD)
  )
    throw Error("Solo Mongo temporal");
  const resultados = [];
  async function caso(nombre, fn) {
    await fn();
    resultados.push(nombre);
    console.log("OK " + nombre);
  }
  try {
    await mongoose.connect(uri, {
      dbName: nombreBD,
      serverSelectionTimeoutMS: 5000,
    });
    for (const modelo of [O, M, U, P, S, D, V, E, Usuario, Revoked])
      await modelo.init();
    const [a, b] = await O.create([
      {
        razon_social: "A sintetica",
        pais: "ES",
        identificador_tipo: "NIF",
        identificador_valor: "B00000001",
        estado: "activa",
      },
      {
        razon_social: "B sintetica",
        pais: "ES",
        identificador_tipo: "NIF",
        identificador_valor: "B00000002",
        estado: "activa",
      },
    ]);
    const miembros = {};
    for (const [nombre, org, rol] of [
      ["admin", a, "administrador"],
      ["lector", a, "colaborador"],
      ["coord", a, "colaborador"],
      ["otro", a, "colaborador"],
      ["adminB", b, "administrador"],
    ]) {
      const usuario = new mongoose.Types.ObjectId();
      await Usuario.collection.insertOne({
        _id: usuario,
        nombre: "Persona sintetica",
        email: usuario + "@example.invalid",
        emailVerifiedAt: new Date(),
        sessionVersion: 0,
        rol: "admin",
      });
      miembros[nombre] = await M.create({
        usuario,
        organizacion: org._id,
        rol,
        estado: "activa",
      });
    }
    const unidad = await U.create({
      organizacion: a._id,
      nombre: "Desarrollo",
      estado: "activa",
    });
    const otra = await U.create({
      organizacion: b._id,
      nombre: "Unidad ajena",
      estado: "activa",
    });
    const pl = await P.create({
      unidad: unidad._id,
      membresia: miembros.lector._id,
      rol: "miembro",
      estado: "activa",
    });
    await P.create({
      unidad: unidad._id,
      membresia: miembros.coord._id,
      rol: "coordinador",
      estado: "activa",
    });
    const app = createApp({ rateLimits:false, politicaSesiones:'legado_pruebas' }),
      raiz = "/organizaciones/" + a._id;
    const cookie = (nombre) =>
      "cyberaudit_token=" +
      jwt.sign(
        {
          id: String(miembros[nombre].usuario),
          jti: crypto.randomUUID(),
          sessionVersion: 0,
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" },
      );
    const api = (method, path, nombre = "admin") =>
      request(app)
        [method](path.startsWith("/organizaciones/") ? path : raiz + path)
        .set("Cookie", cookie(nombre))
        .set("X-Requested-With", "XMLHttpRequest");
    const key = () => crypto.randomUUID();
    const alta = () => ({
      nombre: "SaaS reservas",
      tipo: "producto",
      descripcion: "Alcance sintetico, no afirmación normativa",
    });
    const ok = (r, status = 200) => {
      assert.equal(r.status, status, JSON.stringify(r.body));
      return r.body.data;
    };
    if (standalone) {
      await caso(
        "standalone rechaza escritura sin dejar subespacio ni evento parcial",
        async () => {
          const r = await api("post", "/subespacios")
            .set("Idempotency-Key", key())
            .send(alta());
          assert.equal(r.status, 503);
          assert.equal(await S.countDocuments(), 0);
          assert.equal(await E.countDocuments(), 0);
        },
      );
      return resultados;
    }
    let sub,
      doc,
      claveAlta = key();
    await caso(
      "sin sesión no hay acceso; CSRF ajeno bloquea escrituras",
      async () => {
        assert.equal(
          (await request(app).get(raiz + "/subespacios")).status,
          401,
        );
        assert.equal(
          (
            await api("post", "/subespacios")
              .set("Origin", "https://ajeno.invalid")
              .send(alta())
          ).status,
          403,
        );
      },
    );
    await caso(
      "solo admin empresarial crea subespacio, sin mínimo de miembros",
      async () => {
        for (const rol of ["coord", "lector", "otro"])
          assert.equal(
            (
              await api("post", "/subespacios", rol)
                .set("Idempotency-Key", key())
                .send(alta())
            ).status,
            403,
          );
        sub = ok(
          await api("post", "/subespacios")
            .set("Idempotency-Key", claveAlta)
            .send(alta()),
          201,
        );
        assert.equal(sub.version, 0);
        assert.equal(sub.estado, "activo");
        assert.equal(
          await E.countDocuments({ accion: "subespacio_creado" }),
          1,
        );
      },
    );
    await caso(
      "idempotencia de creación no duplica y detecta clave con otro contenido",
      async () => {
        const repetido = ok(
          await api("post", "/subespacios")
            .set("Idempotency-Key", claveAlta)
            .send(alta()),
          201,
        );
        assert.equal(repetido.id, sub.id);
        assert.equal(await S.countDocuments(), 1);
        assert.equal(
          (
            await api("post", "/subespacios")
              .set("Idempotency-Key", claveAlta)
              .send({ ...alta(), nombre: "Otro" })
          ).status,
          409,
        );
      },
    );
    await caso(
      "miembro no ve espacios sin recurso autorizado; empresa ajena no accede",
      async () => {
        assert.deepEqual(
          ok(await api("get", "/subespacios", "lector")).subespacios,
          [],
        );
        assert.equal(
          (await api("get", "/subespacios/" + sub.id, "lector")).status,
          404,
        );
        assert.equal(
          (await api("get", "/subespacios/" + sub.id, "adminB")).status,
          403,
        );
      },
    );
    await caso(
      "actualización concurrente conserva historial; borrador obsoleto da409",
      async () => {
        const r = await Promise.all(
          ["Cambio A", "Cambio B"].map((nombre) =>
            api("patch", "/subespacios/" + sub.id).send({
              version: 0,
              datos: { nombre },
            }),
          ),
        );
        assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
        sub = ok(await api("get", "/subespacios/" + sub.id));
        assert.equal(sub.version, 1);
        assert.equal(
          await E.countDocuments({ accion: "subespacio_actualizado" }),
          1,
        );
      },
    );
    await caso(
      "fallo al registrar evento revierte también el cambio de subespacio",
      async () => {
        const original = E.create;
        E.create = async () => {
          throw Error("fallo sintetico de evento");
        };
        try {
          assert.equal(
            (
              await api("patch", "/subespacios/" + sub.id).send({
                version: sub.version,
                datos: { nombre: "No guardar" },
              })
            ).status,
            503,
          );
        } finally {
          E.create = original;
        }
        assert.equal((await S.findById(sub.id)).__v, sub.version);
        assert.notEqual((await S.findById(sub.id)).nombre, "No guardar");
      },
    );
    await caso(
      "documento privado por defecto y referencias ajenas rechazadas",
      async () => {
        doc = ok(
          await api("post", "/documentos")
            .set("Idempotency-Key", key())
            .send({
              titulo: "Política de acceso",
              categoriaDocumental: "corporativa",
              vinculos: [
                {
                  subespacioId: sub.id,
                  motivo: "Organización de acceso al servicio",
                },
              ],
            }),
          201,
        );
        assert.deepEqual(doc.lectores, []);
        assert.deepEqual(doc.unidadesLectoras, []);
        assert.equal(
          (
            await api("patch", "/documentos/" + doc.id).send({
              version: 0,
              datos: { unidadesLectoras: [String(otra._id)] },
            })
          ).status,
          404,
        );
        assert.equal(
          (await api("get", "/documentos/" + doc.id, "lector")).status,
          404,
        );
      },
    );
    const pdf = Buffer.from(
      "%PDF-1.7\nDocumento sintetico de prueba, no PDF visual.\n%%EOF\n",
    );
    let pdfKey = key();
    const upload = (
      contenido = pdf,
      clave = pdfKey,
      revision = doc.version,
      nombre = "politica.pdf",
      actor = "admin",
    ) =>
      api("post", "/documentos/" + doc.id + "/versiones", actor)
        .query({ version: String(revision), nombre })
        .set("Idempotency-Key", clave)
        .set("Content-Type", "application/pdf")
        .send(contenido);
    await caso(
      "PDF con versión e integridad; reintento no duplica contenido ni evento",
      async () => {
        const v = ok(await upload(), 201);
        assert.equal(v.numero, 1);
        assert.equal(
          v.sha256,
          crypto.createHash("sha256").update(pdf).digest("hex"),
        );
        ok(await upload(), 201);
        assert.equal(await V.countDocuments(), 1);
        doc = ok(await api("get", "/documentos/" + doc.id));
        assert.equal(doc.versionActual, 1);
        assert.equal(doc.version, 1);
        assert.equal(
          (await api("get", "/documentos/" + doc.id, "lector")).status,
          404,
        );
        assert.deepEqual(
          ok(await api("get", "/subespacios", "lector")).subespacios,
          [],
        );
      },
    );
    await caso(
      "fallo de historial al subir PDF revierte bytes, versión y cambios auxiliares",
      async () => {
        const antesDoc = await D.findById(doc.id).lean();
        const antesOrg = await O.findById(a._id).lean();
        const antesActor = await M.findById(miembros.admin._id).lean();
        const numeroVersiones = await V.countDocuments();
        const numeroEventos = await E.countDocuments();
        const original = E.create;
        E.create = async () => {
          throw Error("fallo sintetico de historial documental");
        };
        try {
          assert.equal(
            (await upload(pdf, key(), doc.version)).status,
            503,
          );
        } finally {
          E.create = original;
        }
        assert.equal(await V.countDocuments(), numeroVersiones);
        assert.equal(await E.countDocuments(), numeroEventos);
        assert.deepEqual(await D.findById(doc.id).lean(), antesDoc);
        assert.deepEqual(await O.findById(a._id).lean(), antesOrg);
        assert.deepEqual(await M.findById(miembros.admin._id).lean(), antesActor);
      },
    );
    await caso(
      "solo PDF, tamaño, tipo, ruta en nombre y permisos antes de cargar",
      async () => {
        assert.equal(
          (await upload(Buffer.from("No es PDF"), key(), doc.version)).status,
          400,
        );
        assert.equal(
          (await upload(pdf, key(), doc.version, "../politica.pdf")).status,
          400,
        );
        assert.equal(
          (await upload(Buffer.alloc(5 * 1024 * 1024 + 1), key(), doc.version))
            .status,
          413,
        );
        assert.equal(
          (await upload(pdf, key(), doc.version, "politica.pdf", "coord"))
            .status,
          403,
        );
        assert.equal(
          (
            await api("post", "/documentos/" + doc.id + "/versiones")
              .set("Content-Type", "text/plain")
              .send("x")
          ).status,
          415,
        );
      },
    );
    await caso(
      "compartir a unidad abre solo ese documento y su subespacio",
      async () => {
        doc = ok(
          await api("patch", "/documentos/" + doc.id).send({
            version: doc.version,
            datos: { unidadesLectoras: [String(unidad._id)] },
          }),
        );
        const lector = ok(await api("get", "/documentos/" + doc.id, "lector"));
        assert.equal(lector.lectores, undefined);
        assert.equal(lector.unidadesLectoras, undefined);
        assert.equal(
          ok(await api("get", "/subespacios", "lector")).subespacios[0].id,
          sub.id,
        );
        assert.equal(
          (await api("get", "/documentos/" + doc.id, "otro")).status,
          404,
        );
        assert.equal(
          (
            await api("patch", "/documentos/" + doc.id, "lector").send({
              version: doc.version,
              datos: { titulo: "Prohibido" },
            })
          ).status,
          403,
        );
        const r = await api(
          "get",
          "/documentos/" + doc.id + "/versiones/1/archivo",
          "lector",
        );
        assert.equal(r.status, 200);
        assert.match(r.headers["content-disposition"], /^attachment/);
        assert.equal(r.headers["cache-control"], "private, no-store");
        assert.equal(
          r.headers["x-document-sha256"],
          crypto.createHash("sha256").update(pdf).digest("hex"),
        );
        assert.equal(r.body.length, pdf.length);
        assert.deepEqual(r.body, pdf);
      },
    );
    await caso(
      "revocar pertenencia retira acceso a espacio y a bytes con la misma cuenta",
      async () => {
        await P.updateOne({ _id: pl._id }, { $set: { estado: "revocada" } });
        assert.equal(
          (
            await api(
              "get",
              "/documentos/" + doc.id + "/versiones/1/archivo",
              "lector",
            )
          ).status,
          404,
        );
        assert.deepEqual(
          ok(await api("get", "/subespacios", "lector")).subespacios,
          [],
        );
        await P.updateOne({ _id: pl._id }, { $set: { estado: "activa" } });
      },
    );
    await caso(
      "revocación de compartición durante descarga descarta bytes ya leídos",
      async () => {
        const original = V.findOne;
        V.findOne = function (...args) {
          const q = original.apply(this, args),
            lean = q.lean;
          q.lean = async function (...params) {
            const r = await lean.apply(this, params);
            await D.updateOne(
              { _id: doc.id },
              { $set: { unidades_lectoras: [] }, $inc: { __v: 1 } },
            );
            return r;
          };
          return q;
        };
        try {
          assert.equal(
            (
              await api(
                "get",
                "/documentos/" + doc.id + "/versiones/1/archivo",
                "lector",
              )
            ).status,
            404,
          );
        } finally {
          V.findOne = original;
        }
        doc = ok(await api("get", "/documentos/" + doc.id));
      },
    );
    await caso(
      "compartición individual y segunda versión conservan ambas descargas",
      async () => {
        doc = ok(
          await api("patch", "/documentos/" + doc.id).send({
            version: doc.version,
            datos: { lectores: [String(miembros.lector._id)] },
          }),
        );
        const pdf2 = Buffer.from(
          "%PDF-1.7\nVersion sintetica DOS de la politica.\n%%EOF\n",
        );
        ok(await upload(pdf2, key(), doc.version), 201);
        doc = ok(await api("get", "/documentos/" + doc.id));
        const versiones = ok(
          await api("get", "/documentos/" + doc.id + "/versiones", "lector"),
        ).versiones;
        assert.deepEqual(
          versiones.map((v) => v.numero),
          [2, 1],
        );
        assert.deepEqual(
          (
            await api(
              "get",
              "/documentos/" + doc.id + "/versiones/1/archivo",
              "lector",
            )
          ).body,
          pdf,
        );
        assert.equal(
          (
            await api(
              "get",
              "/documentos/" + doc.id + "/versiones/2/archivo",
              "lector",
            )
          ).body.length,
          pdf2.length,
        );
      },
    );
    await caso(
      "archivar/restaurar conserva referencias y no admite modificaciones archivadas",
      async () => {
        sub = ok(
          await api("post", "/subespacios/" + sub.id + "/archivar").send({
            version: sub.version,
          }),
        );
        assert.equal(sub.estado, "archivado");
        assert.equal(
          ok(await api("get", "/subespacios/" + sub.id, "lector")).estado,
          "archivado",
        );
        assert.equal(
          (
            await api("patch", "/subespacios/" + sub.id).send({
              version: sub.version,
              datos: { nombre: "No" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await api(
              "get",
              "/documentos/" + doc.id + "/versiones/1/archivo",
              "lector",
            )
          ).status,
          200,
        );
        sub = ok(
          await api("post", "/subespacios/" + sub.id + "/restaurar").send({
            version: sub.version,
          }),
        );
        assert.equal(sub.estado, "activo");
      },
    );
    await caso(
      "historial general filtra subespacios/documentos sin dar acceso extra al coordinador",
      async () => {
        const hs = ok(
          await api("get", "/actividad").query({ subespacioId: sub.id }),
        );
        assert.ok(hs.eventos.some((e) => e.categoria === "documentos"));
        assert.ok(hs.eventos.some((e) => e.categoria === "subespacios"));
        const hd = ok(
          await api("get", "/actividad").query({
            documentoId: doc.id,
            categoria: "documentos",
          }),
        );
        assert.ok(hd.eventos.length >= 4);
        assert.ok(
          hd.eventos.every(
            (e) => e.documentoId === doc.id && e.unidadId === null,
          ),
        );
        assert.deepEqual(
          ok(await api("get", "/actividad", "coord")).eventos,
          [],
        );
        assert.equal((await api("get", "/actividad", "lector")).status, 403);
      },
    );
    await caso(
      "exportación CSV/XLSX real conserva filtros y columnas",
      async () => {
        const csv = await api("get", "/actividad/exportar").query({
          formato: "csv",
          documentoId: doc.id,
          columnas: "fecha,accion,documentoId",
        });
        assert.equal(csv.status, 200);
        assert.match(csv.headers["content-disposition"], /actividad.csv/);
        assert.ok(csv.text.includes(doc.id));
        assert.equal(csv.text.includes("subespacio_creado"), false);
        const x = await api("get", "/actividad/exportar")
          .query({ formato: "xlsx", categoria: "subespacios" })
          .buffer(true)
          .parse((res, cb) => {
            const b = [];
            res.on("data", (d) => b.push(d));
            res.on("end", () => cb(null, Buffer.concat(b)));
          });
        assert.equal(x.status, 200, JSON.stringify(x.body));
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(x.body);
        assert.ok(wb.getWorksheet("Actividad").rowCount > 1);
        assert.ok(wb.getWorksheet("Contexto"));
        assert.equal(
          (await api("get", "/actividad/exportar", "lector")).status,
          403,
        );
      },
    );
    await caso(
      "revocar admin impide nuevas escrituras pese al JWT de admin global",
      async () => {
        await M.updateOne(
          { _id: miembros.admin._id },
          { $set: { rol: "colaborador" } },
        );
        assert.equal(
          (
            await api("post", "/subespacios")
              .set("Idempotency-Key", key())
              .send(alta())
          ).status,
          403,
        );
        await M.updateOne(
          { _id: miembros.admin._id },
          { $set: { rol: "administrador" } },
        );
      },
    );
    return resultados;
  } finally {
    await mongoose.disconnect();
  }
}
module.exports = { comprobar };
