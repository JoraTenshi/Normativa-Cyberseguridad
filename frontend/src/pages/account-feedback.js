// A neutral HTTP response does not certify account existence or email delivery.
export const VERIFICATION_REQUESTED = 'Solicitud recibida. Si existe una cuenta pendiente de confirmación y el servicio de correo está disponible, se intentará enviar un enlace. Este aviso no confirma el envío. Revisa también el correo no deseado; si no llega, contacta con quien administra la aplicación.';
export const REGISTRATION_REQUESTED = 'Solicitud recibida. Si puedes completar el registro con esta dirección y el servicio de correo está disponible, se intentará enviar un enlace de confirmación. Este aviso no confirma la creación de una cuenta ni el envío. Si ya tenías una cuenta, inicia sesión o recupera tu contraseña.';
export const PASSWORD_HELP = 'Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.';
export const validPassword = password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
