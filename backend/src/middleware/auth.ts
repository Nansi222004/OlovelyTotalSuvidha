import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/jwtService';

export type AuthUserType = 'Admin' | 'Seller' | 'Customer' | 'Delivery';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authenticate user by verifying JWT token
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be in format: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired token',
      });
      return;
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
    return;
  }
};

/**
 * Authorize user by checking role (for Admin users)
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required role: ' + roles.join(' or '),
      });
      return;
    }

    next();
  };
};

/**
 * Require specific user type(s)
 */
export const requireUserType = (...userTypes: AuthUserType[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!userTypes.includes(req.user.userType)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Required user type: ' + userTypes.join(' or '),
      });
      return;
    }

    next();
  };
};

/**
 * Require approved/active user for operational routes.
 * Checks the LIVE database status (never trusting stale JWT payload).
 * 
 * - For Seller: requires status === 'Approved'
 * - For Delivery: requires status === 'Active'
 * - For Admin / Customer: allowed through
 */
export const requireApprovedUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { userId, userType } = req.user;

    if (userType === 'Seller') {
      const Seller = (await import('../models/Seller')).default;
      const seller = await Seller.findById(userId).select('status');

      if (!seller) {
        res.status(404).json({
          success: false,
          message: 'Seller account not found',
        });
        return;
      }

      if (seller.status === 'Pending') {
        res.status(403).json({
          success: false,
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your seller account is pending admin approval.',
        });
        return;
      }

      if (seller.status === 'Rejected') {
        res.status(403).json({
          success: false,
          code: 'ACCOUNT_REJECTED',
          message: 'Your seller application has been rejected by the administrator.',
        });
        return;
      }

      if (seller.status !== 'Approved') {
        res.status(403).json({
          success: false,
          code: 'ACCOUNT_NOT_APPROVED',
          message: 'Your seller account is not approved for operations.',
        });
        return;
      }
    } else if (userType === 'Delivery') {
      const Delivery = (await import('../models/Delivery')).default;
      const delivery = await Delivery.findById(userId).select('status');

      if (!delivery) {
        res.status(404).json({
          success: false,
          message: 'Delivery partner account not found',
        });
        return;
      }

      if (delivery.status === 'Inactive') {
        res.status(403).json({
          success: false,
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your delivery partner account is pending admin approval.',
        });
        return;
      }

      if (delivery.status !== 'Active') {
        res.status(403).json({
          success: false,
          code: 'ACCOUNT_NOT_APPROVED',
          message: 'Your delivery partner account is not active for operations.',
        });
        return;
      }
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error verifying account approval status',
      error: error.message,
    });
  }
};

/**
 * Composite middlewares for Seller and Delivery
 */
export const requireApprovedSeller = [authenticate, requireUserType('Seller'), requireApprovedUser];
export const requireApprovedDelivery = [authenticate, requireUserType('Delivery'), requireApprovedUser];

