import { Injectable, UnauthorizedException } from '@nestjs/common';
import { p1User } from '../database/p1-seed';
import { UserSummary } from '../common/p1-contracts';

export interface LoginRequest {
  username?: string;
  password?: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserSummary;
}

@Injectable()
export class AuthService {
  login(request: LoginRequest): LoginResponse {
    if (!request.username || !request.password) {
      throw new UnauthorizedException('用户名或密码不能为空');
    }

    // P1 seed login keeps the route contract stable until the DB-backed users table is wired.
    if (request.username !== 'demo' || request.password !== 'demo123') {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return {
      accessToken: 'p1-dev-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: p1User,
    };
  }

  logout(): { ok: true } {
    return { ok: true };
  }
}
