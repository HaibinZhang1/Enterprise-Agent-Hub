import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { errorBody, ErrorCode } from './p1-contracts';

const statusToCode: Partial<Record<HttpStatus, ErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'permission_denied',
  [HttpStatus.NOT_FOUND]: 'skill_not_found',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'server_unavailable',
};

@Catch()
export class P1HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const code = statusToCode[status] ?? 'server_unavailable';
      const message = typeof exceptionResponse === 'string' ? exceptionResponse : exception.message;
      response.status(status).json(errorBody(code, message, status >= 500));
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorBody('server_unavailable', '服务端暂时不可用', true));
  }
}
