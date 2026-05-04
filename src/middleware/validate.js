const { validationResult } = require('express-validator');
const messages = require('../constants/messages');
const { failure } = require('../utils/response');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array({ onlyFirstError: true })[0];
    return failure(
      res,
      `${messages.VALIDATION_FAILED} ${first.msg}`,
      400
    );
  }
  next();
}

module.exports = { validateRequest };
