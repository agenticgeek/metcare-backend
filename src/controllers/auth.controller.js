const bcrypt = require('bcrypt');
const { getSupabase } = require('../config/supabase');
const messages = require('../constants/messages');
const { t } = require('../utils/i18n');
const { sendPasswordResetEmail } = require('../utils/email');
const { setStudentCookie, clearStudentCookie } = require('../utils/jwt');
const { generateSecureToken, expiresAtFromNow } = require('../utils/token');
const { provisionPendingStudentWithActivationEmail } = require('../utils/provisionStudent');
const { success, failure } = require('../utils/response');

const SALT_ROUNDS = 10;

function sanitizeUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
  };
}

async function fetchUserByEmail(supabase, email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, password_hash, status')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchActivationTokenRow(supabase, rawToken, type) {
  const { data, error } = await supabase
    .from('activation_tokens')
    .select('*')
    .eq('token', rawToken)
    .eq('type', type)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function isExpired(expiresAt) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function normalizedAccountStatus(status) {
  if (status == null || status === '') return '';
  return String(status).trim().toLowerCase();
}

function isDisabledStatus(status) {
  return normalizedAccountStatus(status) === 'disabled';
}

function isPendingStatus(status) {
  return normalizedAccountStatus(status) === 'pending';
}

async function login(req, res) {
  const supabase = getSupabase();
  const { email, password } = req.body;

  const user = await fetchUserByEmail(supabase, email);
  if (!user) {
    return failure(res, t(req, 'LOGIN_GENERIC'), 401);
  }
  if (isDisabledStatus(user.status)) {
    return failure(res, t(req, 'ACCOUNT_DISABLED'), 403);
  }
  if (isPendingStatus(user.status)) {
    return failure(res, t(req, 'ACCOUNT_PENDING'), 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return failure(res, t(req, 'LOGIN_GENERIC'), 401);
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);
  if (updateErr) throw updateErr;

  const access_token = setStudentCookie(res, user.id);
  return success(res, { ...sanitizeUser(user), access_token }, '', 200);
}

/**
 * Public self-registration: pending account + activation email (no session cookie until activate).
 */
async function register(req, res) {
  const supabase = getSupabase();
  const { email, full_name, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return failure(
      res,
      `${messages.VALIDATION_FAILED} ${t(req, 'PASSWORDS_MUST_MATCH')}`,
      400
    );
  }

  const existing = await fetchUserByEmail(supabase, email);
  if (existing) {
    return failure(res, t(req, 'REGISTER_EMAIL_EXISTS'), 409);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const user = await provisionPendingStudentWithActivationEmail(supabase, {
      email,
      full_name: full_name.trim(),
      password_hash,
    });
    return success(res, sanitizeUser(user), t(req, 'REGISTER_SUCCESS'), 201);
  } catch (e) {
    console.error('register error:', e);
    return failure(res, t(req, 'ACTIVATION_EMAIL_FAILED'), 502);
  }
}

/**
 * Read-only token state for /activate and /reset-password page load (no DB writes).
 * data.status: 'valid' | 'invalid' | 'used' | 'expired'
 */
async function tokenCheck(req, res) {
  const supabase = getSupabase();
  const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const type = req.query.type === 'reset' ? 'reset' : 'activation';

  if (!rawToken) {
    return success(res, { status: 'invalid' }, '', 200);
  }

  const row = await fetchActivationTokenRow(supabase, rawToken, type);
  if (!row) {
    return success(res, { status: 'invalid' }, '', 200);
  }
  if (row.used) {
    return success(res, { status: 'used' }, '', 200);
  }
  if (isExpired(row.expires_at)) {
    return success(res, { status: 'expired' }, '', 200);
  }
  return success(res, { status: 'valid' }, '', 200);
}

async function activate(req, res) {
  const supabase = getSupabase();
  const { token: rawToken, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return failure(
      res,
      `${messages.VALIDATION_FAILED} ${t(req, 'PASSWORDS_MUST_MATCH')}`,
      400
    );
  }

  const row = await fetchActivationTokenRow(supabase, rawToken, 'activation');
  if (!row) {
    return failure(res, t(req, 'TOKEN_INVALID'), 400);
  }
  if (row.used) {
    return failure(res, t(req, 'TOKEN_ALREADY_USED'), 400);
  }
  if (isExpired(row.expires_at)) {
    return failure(res, t(req, 'TOKEN_EXPIRED'), 400);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { error: userErr } = await supabase
    .from('users')
    .update({ password_hash, status: 'active' })
    .eq('id', row.user_id);
  if (userErr) throw userErr;

  const { error: tokenErr } = await supabase
    .from('activation_tokens')
    .update({ used: true })
    .eq('id', row.id);
  if (tokenErr) throw tokenErr;

  const { data: fresh, error: fetchErr } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', row.user_id)
    .single();
  if (fetchErr) throw fetchErr;

  const access_token = setStudentCookie(res, fresh.id);
  return success(res, { ...sanitizeUser(fresh), access_token }, '', 200);
}

async function forgotPassword(req, res) {
  const supabase = getSupabase();
  const { email } = req.body;

  try {
    const user = await fetchUserByEmail(supabase, email);
    if (user && String(user.status).toLowerCase() === 'active') {
      const token = generateSecureToken();
      const expires_at = expiresAtFromNow();
      const { error: insertErr } = await supabase.from('activation_tokens').insert({
        user_id: user.id,
        token,
        used: false,
        expires_at,
        type: 'reset',
        created_at: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;
      await sendPasswordResetEmail(user.email, token);
    }
  } catch (e) {
    console.error('forgot-password flow error:', e);
  }

  return success(res, null, t(req, 'FORGOT_PASSWORD_SUCCESS'), 200);
}

async function resetPassword(req, res) {
  const supabase = getSupabase();
  const { token: rawToken, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return failure(
      res,
      `${messages.VALIDATION_FAILED} ${t(req, 'PASSWORDS_MUST_MATCH')}`,
      400
    );
  }

  const row = await fetchActivationTokenRow(supabase, rawToken, 'reset');
  if (!row) {
    return failure(res, t(req, 'RESET_TOKEN_INVALID'), 400);
  }
  if (row.used) {
    return failure(res, t(req, 'TOKEN_ALREADY_USED'), 400);
  }
  if (isExpired(row.expires_at)) {
    return failure(res, t(req, 'TOKEN_EXPIRED'), 400);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { error: userErr } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', row.user_id);
  if (userErr) throw userErr;

  const { error: tokenErr } = await supabase
    .from('activation_tokens')
    .update({ used: true })
    .eq('id', row.id);
  if (tokenErr) throw tokenErr;

  const { data: fresh, error: fetchErr } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', row.user_id)
    .single();
  if (fetchErr) throw fetchErr;

  const access_token = setStudentCookie(res, fresh.id);
  return success(res, { ...sanitizeUser(fresh), access_token }, '', 200);
}

function logout(req, res) {
  clearStudentCookie(res);
  return success(res, null, messages.LOGOUT_SUCCESS, 200);
}

module.exports = {
  register,
  login,
  tokenCheck,
  activate,
  forgotPassword,
  resetPassword,
  logout,
};
