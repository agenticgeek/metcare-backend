const { Router } = require('express');
const { param } = require('express-validator');
const { listModules, getModuleVideoToken } = require('../controllers/module.controller');
const { asyncHandler } = require('../middleware/asyncHandler');
const { studentAuth } = require('../middleware/studentAuth');
const { validateRequest } = require('../middleware/validate');

const router = Router();

router.use(studentAuth);

/**
 * @openapi
 * /modules:
 *   get:
 *     tags: [Modules]
 *     summary: List published modules
 *     security:
 *       - studentCookie: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ordered published modules (includes thumbnail_url; no video_id)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ModuleSummary'
 *       401:
 *         description: Missing or invalid session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/', asyncHandler(listModules));

/**
 * @openapi
 * /modules/{id}/token:
 *   get:
 *     tags: [Modules]
 *     summary: Get Cloudflare Stream signed token for module video
 *     security:
 *       - studentCookie: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module id
 *     responses:
 *       200:
 *         description: Short-lived signed token (~2 hours)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/VideoTokenResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Module not found or not published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       502:
 *         description: Upstream token generation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get(
  '/:id/token',
  [param('id').trim().notEmpty().withMessage('Module id is required.')],
  validateRequest,
  asyncHandler(getModuleVideoToken)
);

module.exports = router;
