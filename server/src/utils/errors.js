export class AppError extends Error {
  constructor(message, statusCode, code, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message, code } = err;

  // Don't log validation errors in full
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation failed: ' + err.errors.map(e => e.message).join(', ');
    code = 'VALIDATION_ERROR';
  }

  // Log server errors
  if (statusCode >= 500) {
    console.error('Server error:', err);
  }

  const response = {
    error: message,
    code: code || 'INTERNAL_ERROR'
  };

  if (err.extra && typeof err.extra === 'object') {
    Object.assign(response, err.extra);
  }

  res.status(statusCode).json(response);
};
