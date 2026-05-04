const { Router } = require('express');
const { body, query } = require('express-validator');
const {
  register,
  login,
  tokenCheck,
  activate,
  forgotPassword,
  resetPassword,
  logout,
} = require('../controllers/auth.controller');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validate');

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Student self-registration (public)
 *     description: |
 *       Creates a **pending** account with the chosen password, stores a single-use activation token (72h),
 *       and emails `${BASE_URL}/activate?token=...`. Does **not** set a session cookie — student must **POST /auth/activate** after clicking the link (password fields can match registration).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterBody'
 *     responses:
 *       201:
 *         description: Account created; activation email sent
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentProfile'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 *       502:
 *         description: Email delivery failed (account not kept)
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('full_name')
      .trim()
      .isString()
      .isLength({ min: 2, max: 200 })
      .withMessage('Full name must be between 2 and 200 characters.'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('confirm_password').isString().notEmpty().withMessage('Confirm password is required.'),
  ],
  validateRequest,
  asyncHandler(register)
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in a student
 *     description: Sets an httpOnly JWT cookie on success. Use Accept-Language (fr|en) for messages. 401 generic wrong credentials; 403 pending or disabled account with distinct messages.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginBody'
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentProfile'
 *       401:
 *         description: Incorrect email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Account pending activation or disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ],
  validateRequest,
  asyncHandler(login)
);

/**
 * @openapi
 * /auth/token-check:
 *   get:
 *     tags: [Auth]
 *     summary: Read-only activation/reset token state (no side effects)
 *     description: For SPA page load on /activate or /reset-password. Returns data.status valid|invalid|used|expired. Always 200.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [activation, reset]
 *         description: Defaults to activation
 *     responses:
 *       200:
 *         description: Token state (never consumes token)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [valid, invalid, used, expired]
 *                 message:
 *                   type: string
 */
router.get(
  '/token-check',
  [
    query('token').trim().notEmpty().withMessage('Token query parameter is required.'),
    query('type').optional().isIn(['activation', 'reset']).withMessage('type must be activation or reset.'),
  ],
  validateRequest,
  asyncHandler(tokenCheck)
);

/**
 * @openapi
 * /auth/activate:
 *   post:
 *     tags: [Auth]
 *     summary: Activate account with token and set password
 *     description: Validates activation token, hashes password, activates user, sets session cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActivateBody'
 *     responses:
 *       200:
 *         description: Activated and logged in
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentProfile'
 *       400:
 *         description: Invalid, used, or expired token; validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post(
  '/activate',
  [
    body('token').trim().isString().notEmpty().withMessage('Token is required.'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('confirm_password').isString().notEmpty().withMessage('Confirm password is required.'),
  ],
  validateRequest,
  asyncHandler(activate)
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset email
 *     description: Always returns 200 with the same message. Email is sent only for active accounts.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordBody'
 *     responses:
 *       200:
 *         description: Acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required.').normalizeEmail()],
  validateRequest,
  asyncHandler(forgotPassword)
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     description: Validates reset token, updates password, sets session cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordBody'
 *     responses:
 *       200:
 *         description: Password reset and logged in
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentProfile'
 *       400:
 *         description: Invalid, used, or expired token; validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post(
  '/reset-password',
  [
    body('token').trim().isString().notEmpty().withMessage('Token is required.'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('confirm_password').isString().notEmpty().withMessage('Confirm password is required.'),
  ],
  validateRequest,
  asyncHandler(resetPassword)
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Clear session cookie
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 */
router.post('/logout', asyncHandler(logout));

module.exports = router;
