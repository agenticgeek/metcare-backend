const messages = require('../constants/messages');
const { failure } = require('../utils/response');

function errorHandler(err, req, res, _next) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message =
    status === 500 ? messages.INTERNAL_ERROR : err.message || messages.INTERNAL_ERROR;
  if (status === 500) {
    console.error(err);
  }
  return failure(res, message, status);
}

module.exports = { errorHandler };
