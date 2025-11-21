/**
 * Centralized logging utility
 * Supports different log levels and formats logs appropriately for dev/prod
 */

const isDevelopment = process.env.NODE_ENV === "development";

// Helper to sanitize sensitive data
const sanitizeData = (data) => {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "authorization",
    "auth",
  ];
  const sanitized = { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
};

// Format log entry
const formatLog = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const sanitizedContext = sanitizeData(context);

  if (isDevelopment) {
    // Development: Human-readable format
    const contextStr =
      Object.keys(sanitizedContext).length > 0
        ? `\nContext: ${JSON.stringify(sanitizedContext, null, 2)}`
        : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  } else {
    // Production: JSON format
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...sanitizedContext,
    });
  }
};

const logger = {
  error: (message, context = {}) => {
    const logEntry = formatLog("error", message, context);
    console.error(logEntry);
  },

  warn: (message, context = {}) => {
    const logEntry = formatLog("warn", message, context);
    console.warn(logEntry);
  },

  info: (message, context = {}) => {
    const logEntry = formatLog("info", message, context);
    console.log(logEntry);
  },

  // Helper to log errors with request context
  logError: (err, req = null) => {
    const context = {
      error: err.message,
      stack: err.stack,
      ...(req && {
        method: req.method,
        path: req.path,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get("user-agent"),
        userId: req.user?.id || null,
      }),
    };

    logger.error(err.message || "Unknown error", context);
  },
};

module.exports = logger;
