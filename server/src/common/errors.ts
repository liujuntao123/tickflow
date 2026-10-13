import { HttpException } from '@nestjs/common';

/**
 * 统一业务异常：序列化为 { error: { code, message, details? } }。
 */
export class AppException extends HttpException {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super({ code, message, details }, status);
  }

  static badRequest(message: string, details?: unknown, code = 'BAD_REQUEST') {
    return new AppException(400, code, message, details);
  }

  static unauthorized(message: string, code = 'UNAUTHORIZED') {
    return new AppException(401, code, message);
  }

  static forbidden(message: string, code = 'FORBIDDEN') {
    return new AppException(403, code, message);
  }

  static notFound(message: string, code = 'NOT_FOUND') {
    return new AppException(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppException(409, code, message);
  }

  static tooManyRequests(message: string, code = 'RATE_LIMITED') {
    return new AppException(429, code, message);
  }
}