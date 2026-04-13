import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { errorBody, ErrorCode } from './p1-contracts';

const statusToCode: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'validation_failed',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'permission_denied',
  [HttpStatus.NOT_FOUND]: 'resource_not_found',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'server_unavailable',
};

const knownCodes = new Set<ErrorCode>([
  'unauthenticated',
  'permission_denied',
  'skill_not_found',
  'resource_not_found',
  'validation_failed',
  'skill_delisted',
  'scope_restricted',
  'package_unavailable',
  'package_too_large',
  'package_file_count_exceeded',
  'hash_mismatch',
  'conversion_failed',
  'server_unavailable',
]);

@Catch()
export class P1HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = typeof exceptionResponse === 'string' ? exceptionResponse : exception.message;
      const code = knownCodes.has(message as ErrorCode) ? (message as ErrorCode) : statusToCode[status] ?? 'server_unavailable';
      response.status(status).json(errorBody(code, message, status >= 500));
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorBody('server_unavailable', '服务端暂时不可用', true));
  }
}
