const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'enc:v1';

const getEncryptionSecret = () => process.env.MONOBANK_TOKEN_SECRET || process.env.JWT_SECRET;

const getEncryptionKey = () => {
  const secret = getEncryptionSecret();

  if (!secret) {
    throw new Error('MONOBANK_TOKEN_SECRET or JWT_SECRET is required for token encryption');
  }

  return crypto.createHash('sha256').update(secret).digest();
};

const isEncryptedToken = (value = '') => String(value).startsWith(`${ENCRYPTION_PREFIX}:`);

const encryptToken = (token) => {
  if (!token || isEncryptedToken(token)) {
    return token;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};

const decryptToken = (value) => {
  if (!value || !isEncryptedToken(value)) {
    return value;
  }

  const [, , ivValue, authTagValue, encryptedValue] = String(value).split(':');

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Stored Monobank token is corrupted');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

module.exports = {
  decryptToken,
  encryptToken,
  isEncryptedToken,
};
