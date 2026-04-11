"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const p1_seed_1 = require("../database/p1-seed");
let AuthService = class AuthService {
    login(request) {
        if (!request.username || !request.password) {
            throw new common_1.UnauthorizedException('用户名或密码不能为空');
        }
        // P1 seed login keeps the route contract stable until the DB-backed users table is wired.
        if (request.username !== 'demo' || request.password !== 'demo123') {
            throw new common_1.UnauthorizedException('用户名或密码错误');
        }
        return {
            accessToken: 'p1-dev-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: p1_seed_1.p1User,
        };
    }
    logout() {
        return { ok: true };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)()
], AuthService);
