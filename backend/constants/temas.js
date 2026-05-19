/**
 * NormativaCheck — Vocabulario cerrado de temas para el cross-mapping multinormativa.
 *
 * Este array es la única fuente de verdad del vocabulario que usa el motor
 * `calcularCoberturaEstimada(...)` de `backend/utils/scoring.js` para estimar
 * el cumplimiento del usuario en normativas que no ha contestado, proyectando
 * la respuesta de una normativa sobre las demás a través de bloques que
 * comparten tags.
 *
 * REGLA DE NEGOCIO
 *   - Lista cerrada: el `enum` de Mongoose (en `backend/models/Normativa.js`)
 *     y el `enum` del JSON Schema (en `backend/seed/schema_normativa.json`)
 *     deben mantenerse sincronizados con este array. Cualquier valor fuera
 *     de la lista será rechazado por el validador antes de que el seed
 *     llegue a Mongo.
 *   - Orden alfabético: facilita revisiones y diffs limpios entre versiones.
 *   - Ampliaciones: requieren consenso de equipo y re-seed completo. No
 *     añadir tags ad-hoc desde el código de aplicación.
 *
 * GUÍA DE USO POR PARTE DEL CONTENIDO NORMATIVO (Cris)
 *   - Los tags se asignan a nivel de **bloque**, no de pregunta.
 *   - Cardinalidad típica: 1 a 3 tags por bloque. 4 es el techo aceptable y
 *     señala que el bloque puede estar sobre-cargado.
 *   - El glosario completo con definiciones, alcance y referencias normativas
 *     está en `glosario_tags_normativa.md` (uso por parte de Cris).
 *
 * CHANGELOG
 *   v2 — Expansión 15 → 29 (mayo 2026)
 *     · Añadidos los 13 tags pendientes del acuerdo original de 27:
 *       ai_governance, backup_recovery, change_management, cloud_security,
 *       communications_security, endpoint_security, identity_management,
 *       legal_compliance, logging_audit_trail, personal_data_protection,
 *       secure_development, security_monitoring, supply_chain_security.
 *     · Añadidos 2 tags nuevos aprobados al revisar el etiquetado de NIS2:
 *       compliance_assessment (cubre la cláusula 9 de ISO 27001, op.mon.2
 *       del ENS, Art. 17 del AI Act y CRA), y human_resources_security
 *       (cubre la sección 6 entera de ISO 27002 y la familia mp.per del ENS).
 *     · Eliminado `logging_monitoring`: se divide deliberadamente en
 *       `logging_audit_trail` (producir y custodiar registros) y
 *       `security_monitoring` (vigilancia activa en tiempo real). Mezclar
 *       ambos en un único tag degradaba el cross-mapping.
 *
 *   IMPORTANTE tras esta migración:
 *     · El bloque `infraestructura` del placeholder inline de ENS en
 *       `backend/seed/seed.js` usaba `logging_monitoring`. Retaguearlo a
 *       `logging_audit_trail` + `security_monitoring` o el seed fallará la
 *       validación del enum.
 *
 *   v1 — Versión inicial con 15 tags.
 */

module.exports = [
  'access_control',            // Quién puede hacer qué: mínimo privilegio, ACLs, RBAC.
  'ai_governance',             // Gobierno de sistemas de IA: clasificación de riesgo, supervisión humana, transparencia (AI Act).
  'asset_management',          // Inventario y clasificación de activos de información.
  'authentication',            // Cómo el sujeto demuestra ser quien dice: contraseñas, MFA, certificados.
  'awareness_training',        // Formación y concienciación del personal en seguridad.
  'backup_recovery',           // Base técnica de copias: ejecución, verificación de integridad, restauración.
  'business_continuity',       // Plan organizativo (BCP/DRP) ante interrupciones graves.
  'change_management',         // Control de cambios en sistemas productivos: aprobación, registro, rollback.
  'cloud_security',            // Seguridad específica de servicios cloud: configuración, responsabilidad compartida, IAM cloud.
  'communications_security',   // Información en tránsito: TLS, VPN, cifrado de comunicaciones.
  'compliance_assessment',     // Evaluación de la eficacia del SGSI: métricas, auditoría interna, revisión por la dirección.
  'cryptography',              // Política de cripto: algoritmos, longitudes de clave, gestión de claves, cifrado en reposo.
  'data_protection',           // Protección de información en general (no solo personal): clasificación, DLP, marcado.
  'endpoint_security',         // Seguridad de dispositivos finales: EDR, antimalware, hardening de puestos y servidores.
  'human_resources_security',  // Verificaciones previas, NDAs, ciclo de vida del empleado, deberes durante y al cese.
  'identity_management',       // Ciclo de vida de identidades: alta, modificación, baja. Quién existe en el sistema.
  'incident_response',         // Detección, contención, erradicación, recuperación y lecciones aprendidas.
  'legal_compliance',          // Obligaciones legales con autoridades: notificaciones, reportes, plazos rígidos.
  'logging_audit_trail',       // Producir y custodiar registros técnicos: qué se registra, integridad, retención.
  'network_security',          // Infraestructura de red: firewalls, segmentación, IDS/IPS, NAC.
  'personal_data_protection',  // Protección específicamente de datos personales (alcance RGPD/LOPDPyGDD).
  'physical_security',         // Control de accesos físicos, áreas seguras, protección ambiental, equipos.
  'risk_management',           // Análisis y tratamiento de riesgos: metodología, evaluación periódica, plan de tratamiento.
  'secure_development',        // Ciclo de desarrollo seguro: requisitos de seguridad, pruebas previas a producción, secure SDLC.
  'security_monitoring',       // Vigilancia activa en tiempo real: SIEM, SOC, alertas, threat hunting.
  'security_policy',           // Política de seguridad de alto nivel aprobada, comunicada y revisada.
  'supplier_risk',             // Plano contractual con proveedores: evaluación previa, cláusulas, SLA.
  'supply_chain_security',     // Plano técnico de lo que entregan terceros: SBOM, firma de actualizaciones, integridad.
  'vulnerability_management'   // Identificación, evaluación, priorización y remediación de vulnerabilidades; gestión de parches.
];
