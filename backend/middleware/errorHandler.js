/**
 * Central Express error handler: JSON body, optional stack in development.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const body = { error: message };
  if (process.env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }
  if (res.headersSent) {
    return next(err);
  }
  res.status(status).json(body);
}

module.exports = { errorHandler };
