/**
 * Helper function to check if an origin is allowed for CORS
 * This matches the logic in server.ts CORS configuration
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    return true; // Allow requests with no origin
  }

  // Always allow any localhost / loopback port
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('https://localhost:') ||
    origin.startsWith('https://127.0.0.1:') ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin)
  ) {
    return true;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // In development, all origins or localhost are allowed
  if (!isProduction) {
    return true;
  }

  // In production, check against allowed origins
  if (isProduction) {
    // Get allowed origins from environment variable (comma-separated)
    const frontendUrl = process.env.FRONTEND_URL || '';
    const corsOrigins = process.env.CORS_ORIGINS || '';
    const allAllowedOrigins = [
      ...frontendUrl.split(','),
      ...corsOrigins.split(','),
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000'
    ]
      .map((url) => url.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '')) // Remove quotes and trailing slashes
      .filter((url) => url.length > 0);

    if (allAllowedOrigins.length === 0) {
      return true;
    }

    // Normalize origin (remove trailing slash if present)
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check if origin matches any allowed origin
    return allAllowedOrigins.some((allowedOrigin) => {
      // Exact match (with and without trailing slash)
      if (normalizedOrigin === allowedOrigin || origin === allowedOrigin) return true;
      // Support for www and non-www variants
      if (allowedOrigin.includes('www.')) {
        const nonWww = allowedOrigin.replace('www.', '');
        if (normalizedOrigin === nonWww || origin === nonWww) return true;
      } else {
        const withWww = allowedOrigin.replace(/^(https?:\/\/)/, '$1www.');
        if (normalizedOrigin === withWww || origin === withWww) return true;
      }
      return false;
    });
  }

  return false;
};

/**
 * Helper function to set CORS headers on a response
 */
export const setCorsHeaders = (res: any, origin: string | undefined): void => {
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-channel, x-seller-channel, X-Channel, X-Seller-Channel');
  }
};

