import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, any>;
  name: string;
}

export const errorHandler = (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error for debugging
  console.error('Error:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
    if (err.keyValue) {
      const field = Object.keys(err.keyValue)[0];
      message = `Duplicate value for field: ${field}`;
    }
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Resource not found';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // content of message is usually sufficient
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      statusCode,
      ... (process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};








