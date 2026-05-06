const messages = require('../constants/messages');
const { COOKIE_NAME, verifyStudentToken } = require('../utils/jwt');
const { failure } = require('../utils/response');
const { asyncHandler } = require('./asyncHandler');
const { getSupabase } = require('../config/supabase');
const { t } = require('../utils/i18n');

function bearerFromAuthorization(req) {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string') return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const raw = m[1].trim();
  return raw || null;
}

function tokenFromCustomHeaders(req) {
  const h =
    req.headers['x-access-token'] ?? req.headers['x-student-access-token'];
  if (typeof h !== 'string') return null;
  const raw = h.trim();
  return raw || null;
}

function getSessionToken(req) {
  const fromCookie = req.cookies[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const bearer = bearerFromAuthorization(req);
  if (bearer) return bearer;
  return tokenFromCustomHeaders(req);
}

async function studentAuth(req, res, next) {
  const debugAuth = process.env.AUTH_DEBUG === '1' || process.env.AUTH_DEBUG === 'true';
  try {
    const token = getSessionToken(req);
    if (!token) {
      if (debugAuth) res.setHeader('X-Auth-Reason', 'missing_token');
      return failure(res, messages.UNAUTHORIZED, 401);
    }
    const payload = verifyStudentToken(token);
    if (payload.role !== 'student') {
      if (debugAuth) res.setHeader('X-Auth-Reason', 'wrong_role');
      return failure(res, messages.UNAUTHORIZED, 401);
    }

    // Check database for latest status
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('status')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error) {
      console.error('[studentAuth] DB check error:', error);
      // Fallback: if DB check fails, we still allow if token is valid?
      // No, for security we should probably fail. 
      return failure(res, messages.INTERNAL_ERROR, 500);
    }

    if (!user) {
      if (debugAuth) res.setHeader('X-Auth-Reason', 'user_not_found');
      return failure(res, messages.UNAUTHORIZED, 401);
    }

    const status = String(user.status || '').toLowerCase().trim();
    if (status === 'disabled') {
      if (debugAuth) res.setHeader('X-Auth-Reason', 'account_disabled');
      return failure(res, t(req, 'ACCOUNT_DISABLED'), 403);
    }
    if (status === 'pending') {
      if (debugAuth) res.setHeader('X-Auth-Reason', 'account_pending');
      return failure(res, t(req, 'ACCOUNT_PENDING'), 403);
    }

    req.user = { id: payload.sub };
    next();
  } catch (err) {
    if (debugAuth) res.setHeader('X-Auth-Reason', 'invalid_token');
    return failure(res, messages.UNAUTHORIZED, 401);
  }
}

module.exports = { studentAuth: asyncHandler(studentAuth) };
