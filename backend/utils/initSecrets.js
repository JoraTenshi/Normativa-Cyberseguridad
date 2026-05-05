const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const envPath = path.join(__dirname, '../.env');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  const secret = crypto.randomBytes(64).toString('hex');

  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    content = /^JWT_SECRET=/m.test(content)
      ? content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
      : content + `\nJWT_SECRET=${secret}\n`;
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('🔑 JWT_SECRET generated and saved to .env');
  } catch {
    console.warn('⚠️  Could not write to .env — JWT_SECRET valid for this session only');
  }

  process.env.JWT_SECRET = secret;
}
