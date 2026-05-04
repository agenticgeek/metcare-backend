const messages = require('../constants/messages');
const { COOKIE_NAME, verifyStudentToken } = require('../utils/jwt');
const { failure } = require('../utils/response');

function studentAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
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
