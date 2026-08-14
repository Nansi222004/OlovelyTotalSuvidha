// import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// TODO: Uncomment rate limiting when deploying to production
// Rate limiting is disabled in development to allow easier testing

/**
 * Rate limiter for OTP requests
 * 5 requests per 15 minutes per mobile number
 *
 * PRODUCTION: Uncomment this and remove the no-op middleware below
 */
// export const otpRateLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // 5 requests per window
//   message: 'Too many OTP requests. Please try again after 15 minutes.',
//   standardHeaders: true,
//   legacyHeaders: false,
//   keyGenerator: (req) => {
//     // Use mobile number from body as key, fallback to IP using proper IPv6 handling
//     if (req.body?.mobile) {
//       return req.body.mobile;
//     }
//     // Use ipKeyGenerator for proper IPv6 handling when falling back to IP
//     return ipKeyGenerator(req.ip || 'unknown');
//   },
// });

/**
 * Rate limiter for login attempts
 * 10 attempts per 15 minutes per IP
 *
 * PRODUCTION: Uncomment this and remove the no-op middleware below
 */
// export const loginRateLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // 10 attempts per window
//   message: 'Too many login attempts. Please try again after 15 minutes.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

/**
 * DEVELOPMENT: No-op middleware (bypasses rate limiting)
 * Remove these when deploying to production and uncomment the rate limiters above
 */
export const otpRateLimiter = (req: Request, _res: Response, next: NextFunction) => {
  // Skip rate limiting for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  next();
};

export const loginRateLimiter = (req: Request, _res: Response, next: NextFunction) => {
  // Skip rate limiting for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  next();
};

