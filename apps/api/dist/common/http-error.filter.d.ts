import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class P1HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
}
