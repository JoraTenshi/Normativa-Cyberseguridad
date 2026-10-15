"use strict";
const mongoose = require("mongoose");
const O = require("../models/Organizacion");
const M = require("../models/Membresia");
const {
  crearServicioContextoOrganizacion,
  ErrorContextoOrganizacion,
} = require("./contextoOrganizacion");
const { ErrorOrganizacion, fallo, id } = require("./datosOrganizacion");
async function indicesUnicos(modelos) {
  const requisitos = [
    [
      O,
      "organizacion_identificador_unico",
      { pais: 1, identificador_tipo: 1, identificador_valor: 1 },
    ],
    [
      M,
      "membresia_organizacion_usuario_unica",
      { organizacion: 1, usuario: 1 },
    ],
    ...modelos,
  ];
  for (const [modelo, nombre, key] of requisitos) {
    const i = (await modelo.collection.listIndexes().toArray()).find(
      (x) => x.name === nombre,
    );
    if (
      !i?.unique ||
      i.sparse ||
      i.partialFilterExpression ||
      JSON.stringify(i.key) !== JSON.stringify(key)
    ) {
      fallo("SERVICIO_NO_DISPONIBLE");
    }
  }
}
async function transaccionAdmin(entrada, modelos, operacion) {
  const e = {
    usuarioId: id(entrada.usuarioId),
    organizacionId: id(entrada.organizacionId),
  };
  try {
    await indicesUnicos(modelos);
    return await mongoose.connection.transaction(
      async (session) => {
        const resolver = crearServicioContextoOrganizacion({
          OrganizacionModel: {
            findById: (x) => O.findById(x).session(session),
          },
          MembresiaModel: { find: (q) => M.find(q).session(session) },
        });
        let contexto;
        try {
          contexto = await resolver(e);
        } catch (err) {
          if (err.cause?.hasErrorLabel?.("TransientTransactionError"))
            throw err.cause;
          throw err;
        }
        if (contexto.rol !== "administrador") fallo("GESTION_DENEGADA");
        // Escrituras reales para detectar suspensión/revocación concurrentes.
        // Misma serialización por empresa usada en gestionUnidades.
        for (const [modelo, filtro] of [
          [O, { _id: e.organizacionId, estado: "activa" }],
          [
            M,
            {
              _id: contexto.membresiaId,
              organizacion: e.organizacionId,
              usuario: e.usuarioId,
              estado: "activa",
              rol: "administrador",
            },
          ],
        ]) {
          const d = await modelo
            .findOneAndUpdate(
              filtro,
              { $inc: { __v: 1 } },
              { session, new: true, timestamps: false },
            )
            .select("_id")
            .lean();
          if (!d) fallo("GESTION_DENEGADA");
        }
        return operacion({ session, contexto });
      },
      {
        readPreference: "primary",
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS: 5000,
      },
    );
  } catch (e) {
    if (
      e instanceof ErrorOrganizacion ||
      e instanceof ErrorContextoOrganizacion
    )
      throw e;
    if (["ValidationError", "CastError", "StrictModeError"].includes(e.name))
      throw new ErrorOrganizacion("DATOS_INVALIDOS", e);
    if (e.code === 11000) throw new ErrorOrganizacion("CLAVE_REUTILIZADA");
    throw new ErrorOrganizacion("SERVICIO_NO_DISPONIBLE", e);
  }
}
module.exports = { transaccionAdmin };
