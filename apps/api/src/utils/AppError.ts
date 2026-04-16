/**
 * Operational error class. Thrown anywhere in the service layer and caught
 * by the global error handler. Non-operational errors (bugs) bubble up as
 * generic 500s.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, code?: string): AppError {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = 'Unauthorized', code?: string): AppError {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code?: string): AppError {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Not found', code?: string): AppError {
    return new AppError(message, 404, code);
  }

  static conflict(message: string, code?: string): AppError {
    return new AppError(message, 409, code);
  }

  static tooMany(message = 'Too many requests', code?: string): AppError {
    return new AppError(message, 429, code);
  }
}
