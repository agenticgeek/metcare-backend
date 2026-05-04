function success(res, data = null, message = '', status = 200) {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
}

function failure(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    message,
  });
}

module.exports = { success, failure };
