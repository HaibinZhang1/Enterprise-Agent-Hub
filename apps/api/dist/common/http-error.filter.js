"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.P1HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const p1_contracts_1 = require("./p1-contracts");
const statusToCode = {
    [common_1.HttpStatus.UNAUTHORIZED]: 'unauthenticated',
    [common_1.HttpStatus.FORBIDDEN]: 'permission_denied',
    [common_1.HttpStatus.NOT_FOUND]: 'skill_not_found',
    [common_1.HttpStatus.SERVICE_UNAVAILABLE]: 'server_unavailable',
};
let P1HttpExceptionFilter = class P1HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            const code = statusToCode[status] ?? 'server_unavailable';
            const message = typeof exceptionResponse === 'string' ? exceptionResponse : exception.message;
            response.status(status).json((0, p1_contracts_1.errorBody)(code, message, status >= 500));
            return;
        }
        response
            .status(common_1.HttpStatus.INTERNAL_SERVER_ERROR)
            .json((0, p1_contracts_1.errorBody)('server_unavailable', '服务端暂时不可用', true));
    }
};
exports.P1HttpExceptionFilter = P1HttpExceptionFilter;
exports.P1HttpExceptionFilter = P1HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], P1HttpExceptionFilter);
