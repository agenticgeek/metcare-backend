const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'student_session';
const JWT_EXPIRES_IN = '7d';

function getSecret() {
  const secret = process.env.JWT_STUDENT_SECRET;
  if (!secret) {
    throw new Error('JWT_STUDENT_SECRET is not configured');
  }
  return secret;
}

function signStudentToken(userId) {
  return jwt.sign({ sub: String(userId), role: 'student' }, getSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyStudentToken(token) {
  return jwt.verify(token, getSecret());
}

function cookieOptions() {
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

function setStudentCookie(res, userId) {
  const token = signStudentToken(userId);
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearStudentCookie(res) {
  const { httpOnly, secure, sameSite, path } = cookieOptions();
  res.clearCookie(COOKIE_NAME, { httpOnly, secure, sameSite, path });
}

module.exports = {
  COOKIE_NAME,
  signStudentToken,
  verifyStudentToken,
  cookieOptions,
  setStudentCookie,
  clearStudentCookie,
};
