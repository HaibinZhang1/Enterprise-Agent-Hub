"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const http_error_filter_1 = require("./common/http-error.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalFilters(new http_error_filter_1.P1HttpExceptionFilter());
    app.enableCors({ origin: true, credentials: true });
    const port = Number(process.env.API_PORT ?? '3000');
    await app.listen(port, '0.0.0.0');
}
void bootstrap();
