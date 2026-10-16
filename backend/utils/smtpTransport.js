'use strict';

// No caller-supplied TLS overrides: authentication requires a verified channel.
function opcionesSmtp({host, port, username, password}) {
  if (![465, 587].includes(port) || typeof host !== 'string' || !host ||
      /[\s\x00-\x1f]/.test(host) || typeof username !== 'string' || !username ||
      typeof password !== 'string' || !password) {
    throw new Error('SMTP_CONFIG_INVALID');
  }
  return {
    host, port, secure: port === 465,
    requireTLS: port === 587, ignoreTLS: false, opportunisticTLS: false,
    tls: {servername: host, rejectUnauthorized: true, minVersion: 'TLSv1.2'},
    auth: {user: username, pass: password},
    connectionTimeout: 15000, greetingTimeout: 10000,
    socketTimeout: 20000, dnsTimeout: 10000,
    logger: false, debug: false, transactionLog: false,
    disableFileAccess: true, disableUrlAccess: true
  };
}

function errorCorreoSeguro(error) {
  // Never propagate the SMTP response, message, cause, envelope or server URL.
  const categories = {
    EAUTH: 'SMTP_AUTH_FAILED', ETLS: 'SMTP_TLS_FAILED',
    ESOCKET: 'SMTP_CONNECTION_FAILED', ECONNECTION: 'SMTP_CONNECTION_FAILED',
    EDNS: 'SMTP_CONNECTION_FAILED', ETIMEDOUT: 'SMTP_TIMEOUT',
    EENVELOPE: 'SMTP_ENVELOPE_REJECTED', EMESSAGE: 'SMTP_MESSAGE_REJECTED'
  };
  const code = Object.hasOwn(categories, error?.code) ? categories[error.code] : 'SMTP_SEND_FAILED';
  return Object.assign(new Error(code), {code});
}

module.exports = {opcionesSmtp, errorCorreoSeguro};
