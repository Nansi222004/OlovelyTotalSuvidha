import jwt from 'jsonwebtoken';
import { UserType } from '../models/Otp';

export interface TokenPayload {
  userId: string;
  userType: UserType;
  role?: string;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined in backend configuration');
  }
  return secret;
};
const getExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(userId: string, userType: UserType, role?: string): string {
  const payload: TokenPayload = {
    userId,
    userType,
    ...(role && { role }),
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getExpiresIn(),
  } as jwt.SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
    return decoded;
  } catch (error: any) {
    console.error('JWT verify error:', error.message, 'token:', token.substring(0, 20) + '...');
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw new Error(`Token verification failed: ${error.message}`);
  }
}


