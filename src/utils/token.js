const crypto = require('crypto');

const ACTIVATION_RESET_TTL_MS = 72 * 60 * 60 * 1000;

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function expiresAtFromNow() {
  return new Date(Date.now() + ACTIVATION_RESET_TTL_MS).toISOString();
}

module.exports = {
  generateSecureToken,
  expiresAtFromNow,
  ACTIVATION_RESET_TTL_MS,
};
