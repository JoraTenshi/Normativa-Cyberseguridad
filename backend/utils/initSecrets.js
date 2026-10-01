const jwtSecret = process.env.JWT_SECRET || '';

if (!/^[0-9a-f]{64,}$/i.test(jwtSecret) || jwtSecret.length % 2 !== 0) {
  throw new Error('JWT_SECRET debe ser hexadecimal y tener al menos 32 bytes');
}

const totpKey = process.env.TOTP_ENCRYPTION_KEY || '';

if (!/^[0-9a-f]{64}$/i.test(totpKey)) {
  throw new Error('TOTP_ENCRYPTION_KEY debe ser hexadecimal y tener 32 bytes');
}

if (totpKey.toLowerCase() === jwtSecret.toLowerCase()) {
  throw new Error('TOTP_ENCRYPTION_KEY debe ser distinta de JWT_SECRET');
}
