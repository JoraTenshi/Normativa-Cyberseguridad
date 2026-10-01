
function escaparHtml(valor) {
	const entidades = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#039;'
	};
	return String(valor).replace(
		/[&<>"']/g,
		caracter=> entidades[caracter]
		);
}

function validarEnlaceVerificacion(enlaceVerificacion) {
	const url = new URL(enlaceVerificacion);
	if (url.protocol !== 'https:') {
		throw new Error(
			'EL enlace de verificación debe utilizar HTTPS.'
			);
			}
return url.toString();
}

function crearPlantillaBienvenida(nombre,enlaceVerificacion) {
	const enlaceValidado = validarEnlaceVerificacion(enlaceVerificacion);
	const nombreSeguro = escaparHtml(nombre);
	const enlaceSeguro = escaparHtml(enlaceValidado);
	const subject = 'NormativaCheck | Bienvenida y confirmación de correo';
	const text = `Estimado/a ${nombre}:


Le damos la bienvenida a NormativaCheck y le agradecemos su interés en nuestra plataforma.

NormativaCheck está dirigida a empresas y profesionales autónomos que necesitan evaluar su situación en materia de ciberseguridad y cumplimiento, identificar áreas de mejora y establecer prioridades de actuación.

La plataforma reúne cuestionarios y referencias de distinta naturaleza:

- Leyes, como la Ley Orgánica 3/2018 (LOPDGDD), sobre protección de datos personales y garantía de los derechos digitales: https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673
- Reglamentos, como el Reglamento General de Protección de Datos (RGPD): https://eur-lex.europa.eu/eli/reg/2016/679/spa
- Normas y estándares internacionales, como ISO/IEC 27001, sobre sistemas de gestión de la seguridad de la información, e ISO/IEC 27002, sobre controles de seguridad: https://www.iso.org/standard/27001 y https://www.iso.org/standard/75652.html
- Guías y buenas prácticas, como las orientaciones de INCIBE para elaborar un Plan Director de Seguridad: https://www.incibe.es/empresas/blog/sabes-mejorar-ciberseguridad-tu-organizacion-implanta-plan-director


Para completar su registro, confirme su dirección de correo electrónico:

Confirmar mi correo: ${enlaceValidado}


La aplicabilidad y el carácter obligatorio de cada referencia deben valorarse según la actividad y las circunstancias de cada organización.


De la evaluación a la planificación

Mediante cuestionarios estructurados y un cálculo ponderado de sus respuestas, podrá consultar indicadores por áreas y detectar aspectos que requieren atención.

El módulo de Plan Director de Seguridad (PDS) complementa estos resultados con una propuesta de acciones priorizadas, elaborada a partir de la información facilitada. Su finalidad es proporcionar una base de trabajo para planificar mejoras y someterlas a revisión y aprobación por los responsables correspondientes. Asimismo, podrá consultar sus evaluaciones guardadas en el historial.


Información útil para quienes asumen la responsabilidad de la seguridad

Tanto si gestiona personalmente la seguridad de su actividad como si forma parte de un equipo de TI, cumplimiento o seguridad —con un CISO interno o un servicio externo de dirección de seguridad, vCISO—, NormativaCheck le ayuda a estructurar información para apoyar sus decisiones y comunicar prioridades a la dirección y, cuando proceda, al consejo de administración.


Reciba un cordial saludo.

El equipo de NormativaCheck


El enlace de confirmación es personal, de un solo uso y tiene una vigencia limitada. Si no ha solicitado esta cuenta, puede ignorar este mensaje.

La autoevaluación y el PDS generado se basan en la información facilitada. Constituyen instrumentos de apoyo a la gestión, no una auditoría independiente ni una certificación de cumplimiento.`;

	const html = `<div style="font-family: Arial, sans-serif; color: #132238; line-height: 1.6; max-width: 640px; margin: 0 auto; background-color: #f6f8fb; padding: 32px; border: 1px solid #e3e8ef; border-radius: 8px; box-sizing: border-box;">
  <h1 style="font-size: 24px; margin-bottom: 24px;">
    Bienvenido/a a NormativaCheck
  </h1>

  <p>Estimado/a ${nombreSeguro}:</p>

  <p>
    Le damos la bienvenida a NormativaCheck y le agradecemos
    su interés en nuestra plataforma.
  </p>

   <p>
  NormativaCheck está dirigida a empresas y profesionales autónomos
  que necesitan evaluar su situación en materia de ciberseguridad y
  cumplimiento, identificar áreas de mejora y establecer prioridades
  de actuación.
  </p>

  <p>
    Para completar su registro, confirme su dirección
    de correo electrónico:
  </p>

  <p style="margin: 28px 0;">
    <a
      href="${enlaceSeguro}"
      style="display: inline-block; background-color: #b89646; color: #0b1a2d; padding: 12px 20px; text-decoration: none; font-weight: 700; border-radius: 4px;">
      Confirmar mi correo
    </a>
  </p>

<h2 style="font-size: 18px; color: #132238; margin: 32px 0 12px;">
  Referencias para una evaluación estructurada
</h2>

<p>
  La plataforma reúne cuestionarios y referencias de distinta naturaleza:
</p>

<ul style="padding-left: 22px; margin: 0 0 20px;">
  <li style="margin-bottom: 12px;">
    <strong>Leyes</strong>, como la
    <a
      href="https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673"
      style="color: #274c77;"
    >
      Ley Orgánica 3/2018 (LOPDGDD)</a>,
    sobre protección de datos personales y garantía de los derechos digitales.
  </li>

  <li style="margin-bottom: 12px;">
    <strong>Reglamentos</strong>, como el
    <a
      href="https://eur-lex.europa.eu/eli/reg/2016/679/spa"
      style="color: #274c77;"
    >
      Reglamento General de Protección de Datos (RGPD)</a>.
  </li>

  <li style="margin-bottom: 12px;">
    <strong>Normas y estándares internacionales</strong>, como
    <a
      href="https://www.iso.org/standard/27001"
      style="color: #274c77;"
    >
      ISO/IEC 27001</a>,
    sobre sistemas de gestión de la seguridad de la información, e
    <a
      href="https://www.iso.org/standard/75652.html"
      style="color: #274c77;"
    >
      ISO/IEC 27002</a>,
    sobre controles de seguridad.
  </li>

  <li style="margin-bottom: 12px;">
    <strong>Guías y buenas prácticas</strong>, como las
    <a
      href="https://www.incibe.es/empresas/blog/sabes-mejorar-ciberseguridad-tu-organizacion-implanta-plan-director"
      style="color: #274c77;"
    >
      orientaciones de INCIBE para elaborar un Plan Director de Seguridad</a>.
  </li>
</ul>

<p>
  La aplicabilidad y el carácter obligatorio de cada referencia deben
  valorarse según la actividad y las circunstancias de cada organización.
</p>

<h2 style="font-size: 18px; color: #132238; margin: 32px 0 12px;">
  De la evaluación a la planificación
</h2>

<p>
  Mediante cuestionarios estructurados y un cálculo ponderado de sus
  respuestas, podrá consultar indicadores por áreas y detectar aspectos
  que requieren atención.
</p>

<p>
  El módulo de <strong>Plan Director de Seguridad (PDS)</strong>
  complementa estos resultados con una propuesta de acciones priorizadas,
  elaborada a partir de la información facilitada. Su finalidad es
  proporcionar una base de trabajo para planificar mejoras y someterlas
  a revisión y aprobación por los responsables correspondientes.
  Asimismo, podrá consultar sus evaluaciones guardadas en el historial.
</p>

<h2 style="font-size: 18px; color: #132238; margin: 32px 0 12px;">
  Información útil para quienes asumen la responsabilidad de la seguridad
</h2>

<p>
  Tanto si gestiona personalmente la seguridad de su actividad como si
  forma parte de un equipo de TI, cumplimiento o seguridad —con un CISO
  interno o un servicio externo de dirección de seguridad, vCISO—,
  NormativaCheck le ayuda a estructurar información para apoyar sus
  decisiones y comunicar prioridades a la dirección y, cuando proceda,
  al consejo de administración.
</p>

<p style="margin: 28px 0 0;">
	Reciba un cordial saludo.
</p>

<p style="margin: 24px 0 0;">
	<strong>El equipo de NormativaCheck</strong>
</p>

<hr style="border: 0; border-top: 1px solid #d6dde6; margin: 28px 0;">

<p style="font-size: 13px; color: #5b6777;">
  El enlace de confirmación es personal, de un solo uso y tiene una
  vigencia limitada. Si no ha solicitado esta cuenta, puede ignorar
  este mensaje.
</p>

<p style="font-size: 13px; color: #5b6777;">
  La autoevaluación y el PDS generado se basan en la información
  facilitada. Constituyen instrumentos de apoyo a la gestión, no una
  auditoría independiente ni una certificación de cumplimiento.
</p>
</div>`;

  return {
	subject,
	text,
	html
	};
}

module.exports = { crearPlantillaBienvenida };
