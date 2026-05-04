const { generateSecureToken, expiresAtFromNow } = require('./token');
const { sendActivationEmail } = require('./email');

/**
 * Insert pending user + activation token and send activation email.
 * Rolls back user/token if email fails. Throws on hard failures after cleanup.
 */
async function provisionPendingStudentWithActivationEmail(
  supabase,
  { email, full_name, password_hash }
) {
  const { data: user, error: insertUserErr } = await supabase
    .from('users')
    .insert({
      email,
      full_name,
      password_hash,
      status: 'pending',
    })
    .select('id, email, full_name')
    .single();

  if (insertUserErr) throw insertUserErr;

  const token = generateSecureToken();
  const expires_at = expiresAtFromNow();

  const { error: tokErr } = await supabase.from('activation_tokens').insert({
    user_id: user.id,
    token,
    used: false,
    expires_at,
    type: 'activation',
    created_at: new Date().toISOString(),
  });

  if (tokErr) {
    await supabase.from('users').delete().eq('id', user.id);
    throw tokErr;
  }

  try {
    await sendActivationEmail(user.email, token);
  } catch (e) {
    await supabase.from('activation_tokens').delete().eq('user_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
    throw e;
  }

  return user;
}

module.exports = { provisionPendingStudentWithActivationEmail };
