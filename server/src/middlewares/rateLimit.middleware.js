const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for auth endpoints — prevents brute-force attacks.
 * 10 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { success: false, message: 'Too many attempts — please try again in 15 minutes.' },
});

/**
 * General API limiter — prevents abuse on all routes.
 * 200 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs:         60 * 1000, // 1 minute
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { success: false, message: 'Too many requests — please slow down.' },
});

module.exports = { authLimiter, apiLimiter };
