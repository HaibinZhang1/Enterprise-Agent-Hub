import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserSummary } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';
import { P1_TOKEN_PREFIX } from './p1-auth.guard';

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
  constructor(private readonly database: DatabaseService) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    if (!request.username || !request.password) {
      throw new UnauthorizedException('用户名或密码不能为空');
    }

    const user = await this.database.one<{
      id: string;
      password_hash: string;
      display_name: string;
      role: 'normal_user' | 'admin';
      department_id: string;
      department_name: string;
    }>(
      `
      SELECT u.id, u.password_hash, u.display_name, u.role, u.department_id, d.name AS department_name
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.username = $1 AND u.status = 'active'
      `,
      [request.username],
    );

    if (!user || !this.passwordMatches(request.password, user.password_hash)) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const summary = this.toUserSummary(user);
    return {
      accessToken: `${P1_TOKEN_PREFIX}:${user.id}`,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: summary,
    };
  }

  logout(): { ok: true } {
    return { ok: true };
  }

  private passwordMatches(password: string, passwordHash: string): boolean {
    return password === 'demo123' && passwordHash === 'p1-dev-only-hash';
  }

  private toUserSummary(row: {
    id: string;
    display_name: string;
    role: 'normal_user' | 'admin';
    department_id: string;
    department_name: string;
  }): UserSummary {
    return {
      userID: row.id,
      displayName: row.display_name,
      role: row.role,
      departmentID: row.department_id,
      departmentName: row.department_name,
      locale: 'zh-CN',
    };
  }
}
