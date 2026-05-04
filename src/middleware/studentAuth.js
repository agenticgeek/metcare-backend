const messages = require('../constants/messages');
const { COOKIE_NAME, verifyStudentToken } = require('../utils/jwt');
const { failure } = require('../utils/response');

function getSessionToken(req) {
  const fromCookie = req.cookies[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const raw = auth.slice(7).trim();
    return raw || null;
  }
  return null;
}

function studentAuth(req, res, next) {
  try {
    const token = getSessionToken(req);
    if (!token) {
      return failure(res, messages.UNAUTHORIZED, 401);
    }
    const payload = verifyStudentToken(token);
    if (payload.role !== 'student') {
      return failure(res, messages.UNAUTHORIZED, 401);
    }
    req.user = { id: payload.sub };
    next();
  } catch {
    return failure(res, messages.UNAUTHORIZED, 401);
  }
}

module.exports = { studentAuth };
