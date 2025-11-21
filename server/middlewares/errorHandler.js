const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = { message, statusCode: 404 };
    logger.warn(message, {
      originalError: err.message,
      path: req.path,
      method: req.method,
      userId: req.user?.id || null,
    });
  }

  // Mongoose duplicate key
  else if (err.code === 11000) {
    const message = "Duplicate field value entered";
    error = { message, statusCode: 400 };
    logger.warn(message, {
      originalError: err.message,
      path: req.path,
      method: req.method,
      userId: req.user?.id || null,
    });
  }

  // Mongoose validation error
  else if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error = { message, statusCode: 400 };
    logger.warn(message, {
      originalError: err.message,
      validationErrors: Object.values(err.errors).map((e) => e.message),
      path: req.path,
      method: req.method,
      userId: req.user?.id || null,
    });
  }

  // JWT errors
  else if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = { message, statusCode: 401 };
    logger.warn(message, {
      path: req.path,
      method: req.method,
    });
  } else if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = { message, statusCode: 401 };
    logger.warn(message, {
      path: req.path,
      method: req.method,
    });
  }

  // Default server error
  else {
    // Log full error details for server errors
    logger.logError(err, req);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
