// Sentry Configuration Template
// Install with: npm install @sentry/node @sentry/tracing

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

/**
 * Initialize Sentry error tracking
 */
function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance monitoring
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app }),
      new Tracing.Integrations.Postgres(),
      new Tracing.Integrations.Redis(),
    ],

    // Sample rate for performance monitoring
    // 1.0 = 100%, 0.1 = 10%, etc.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Filter out sensitive data
    beforeSend(event) {
      // Remove passwords from error data
      if (event.request && event.request.data) {
        try {
          const data = JSON.parse(event.request.data);
          if (data.password) {
            data.password = '[Filtered]';
          }
          if (data.refreshToken) {
            data.refreshToken = '[Filtered]';
          }
          event.request.data = JSON.stringify(data);
        } catch (e) {
          // Ignore parsing errors
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized');
}

/**
 * Request handler middleware (must be first)
 */
function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/**
 * Tracing middleware
 */
function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Error handler middleware (must be after all routes)
 */
function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture exception manually
 */
function captureException(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Set user context
 */
function setUser(userId, email) {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser({
      id: userId,
      email,
    });
  }
}

/**
 * Clear user context
 */
function clearUser() {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

module.exports = {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  captureException,
  setUser,
  clearUser,
};
