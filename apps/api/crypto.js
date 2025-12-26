const crypto = require('crypto');

// Encryption key should be 32 bytes for AES-256
// In production, this MUST come from AWS Secrets Manager or KMS
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.error('CRITICAL: TOKEN_ENCRYPTION_KEY environment variable is not set');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a token using AES-256-GCM
 * @param {string} plaintext - The token to encrypt
 * @returns {string} - Base64 encoded encrypted string (iv:authTag:ciphertext)
 */
function encrypt(plaintext) {
    if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
    }

    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) {
        throw new Error('Invalid encryption key length. Must be 64 hex characters (32 bytes)');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64 encoded)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a token using AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted string (iv:authTag:ciphertext)
 * @returns {string} - The decrypted token
 */
function decrypt(encryptedData) {
    if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
    }

    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) {
        throw new Error('Invalid encryption key length. Must be 64 hex characters (32 bytes)');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Generate a new encryption key (for setup purposes)
 * @returns {string} - 64 character hex string (32 bytes)
 */
function generateKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    generateKey
};
