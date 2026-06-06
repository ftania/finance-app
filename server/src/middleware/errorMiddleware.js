const { ValidationError, UniqueConstraintError } = require('sequelize');

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let errors;

  if (error instanceof UniqueConstraintError) {
    statusCode = 409;
    message = 'User with this email already exists';
  }

  if (error instanceof ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = error.errors.map((item) => ({
      field: item.path,
      message: item.message,
    }));
  }

  res.status(statusCode).json({
    message,
    ...(errors ? { errors } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
