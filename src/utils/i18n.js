/**
 * Auth API copy — EN/FR per student brief (Accept-Language: fr or en).
 * Non-auth routes keep using constants/messages.js (English).
 */

const STRINGS = {
  en: {
    LOGIN_GENERIC: 'Incorrect email or password.',
    ACCOUNT_PENDING: 'Your account is not yet activated. Check your emails.',
    ACCOUNT_DISABLED:
      'Your account has been disabled. Contact your administrator.',
    FORGOT_PASSWORD_SUCCESS:
      'If an account exists with this email, you will receive a reset link shortly.',
    TOKEN_INVALID: 'This link is invalid.',
    TOKEN_ALREADY_USED:
      'This link has already been used. Sign in directly.',
    TOKEN_EXPIRED: 'This link has expired — contact your administrator.',
    RESET_TOKEN_INVALID: 'This link is invalid.',
    PASSWORDS_MUST_MATCH: 'Passwords must match.',
    REGISTER_SUCCESS:
      'Check your email to activate your account before signing in.',
    REGISTER_EMAIL_EXISTS: 'An account with this email already exists.',
    ACTIVATION_EMAIL_FAILED:
      'Could not send activation email. Check Resend configuration.',
  },
  fr: {
    LOGIN_GENERIC: 'Email ou mot de passe incorrect.',
    ACCOUNT_PENDING:
      "Votre compte n'est pas encore activé. Vérifiez vos emails.",
    ACCOUNT_DISABLED:
      'Votre compte a été désactivé. Contactez votre administrateur.',
    FORGOT_PASSWORD_SUCCESS:
      'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes.',
    TOKEN_INVALID: 'Ce lien est invalide.',
    TOKEN_ALREADY_USED:
      'Ce lien a déjà été utilisé. Connectez-vous directement.',
    TOKEN_EXPIRED: 'Ce lien a expiré — contactez votre administrateur.',
    RESET_TOKEN_INVALID: 'Ce lien est invalide.',
    PASSWORDS_MUST_MATCH: 'Les mots de passe ne correspondent pas.',
    REGISTER_SUCCESS:
      'Vérifiez vos emails pour activer votre compte avant de vous connecter.',
    REGISTER_EMAIL_EXISTS: 'Un compte existe déjà avec cet email.',
    ACTIVATION_EMAIL_FAILED:
      "Impossible d'envoyer l'email d'activation. Vérifiez la configuration Resend.",
  },
};

function pickLocale(req) {
  if (!req?.headers?.['accept-language']) return 'en';
  const first = String(req.headers['accept-language']).split(',')[0].trim().toLowerCase();
  if (first.startsWith('fr')) return 'fr';
  return 'en';
}

function t(req, key) {
  const locale = pickLocale(req);
  const pack = STRINGS[locale] || STRINGS.en;
  return pack[key] ?? STRINGS.en[key] ?? key;
}

module.exports = { t, pickLocale, STRINGS };
