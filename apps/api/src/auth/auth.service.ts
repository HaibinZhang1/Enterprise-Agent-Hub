import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MenuPermission, UserSummary } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';
import { PermissionResolverService } from './permission-resolver.service';
import { verifyPassword } from './password';
import { P1_TOKEN_PREFIX } from './constants';

export interface LoginRequest {
  username?: string;
  password?: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: string;
  user: UserSummary;
  menuPermissions: MenuPermission[];
}

export interface AuthenticatedSession {
  sessionID: string;
  user: UserSummary;
  menuPermissions: MenuPermission[];
}

interface UserRow {
  id: string;
  password_hash: string;
  display_name: string;
  role: 'normal_user' | 'admin';
  admin_level: number | null;
  department_id: string;
  department_name: string;
}

@Injectable()
export class AuthService {
  private readonly sessionLifetimeSeconds = 8 * 60 * 60;

  constructor(
    private readonly database: DatabaseService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    if (!request.username || !request.password) {
      throw new UnauthorizedException('用户名或密码不能为空');
    }

    const user = await this.database.one<UserRow>(
      `
      SELECT u.id, u.password_hash, u.display_name, u.role, u.admin_level, u.department_id, d.name AS department_name
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.username = $1 AND u.status = 'active'
      `,
      [request.username],
    );

    if (!user || !verifyPassword(request.password, user.password_hash)) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const session = await this.createSession(user.id);
    const summary = this.toUserSummary(user);
    return {
      accessToken: `${P1_TOKEN_PREFIX}:${session.rawToken}`,
      tokenType: 'Bearer',
      expiresIn: this.sessionLifetimeSeconds,
      expiresAt: session.expiresAt,
      user: summary,
      menuPermissions: this.permissionResolver.menuPermissionsFor(summary),
    };
  }

  async logout(sessionID: string | null): Promise<{ ok: true }> {
    if (sessionID) {
      await this.database.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [sessionID]);
    }
    return { ok: true };
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedSession> {
    const tokenHash = hashAccessToken(token);
    const session = await this.database.one<{
      session_id: string;
      expires_at: Date;
      user_id: string;
      display_name: string;
      role: 'normal_user' | 'admin';
      admin_level: number | null;
      department_id: string;
      department_name: string;
      status: string;
    }>(
      `
      SELECT
        s.id AS session_id,
        s.expires_at,
        u.id AS user_id,
        u.display_name,
        u.role,
        u.admin_level,
        u.department_id,
        d.name AS department_name,
        u.status
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN departments d ON d.id = u.department_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      `,
      [tokenHash],
    );

    if (!session || session.status !== 'active') {
      throw new UnauthorizedException('unauthenticated');
    }

    const user: UserSummary = {
      userID: session.user_id,
      displayName: session.display_name,
      role: session.role,
      adminLevel: session.admin_level ?? undefined,
      departmentID: session.department_id,
      departmentName: session.department_name,
      locale: 'zh-CN',
    };

    return {
      sessionID: session.session_id,
      user,
      menuPermissions: this.permissionResolver.menuPermissionsFor(user),
    };
  }

  async revokeAllSessionsForUser(userID: string): Promise<void> {
    await this.database.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userID]);
  }

  private async createSession(userID: string): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = randomBytes(32).toString('hex');
    const sessionID = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionLifetimeSeconds * 1000);
    await this.database.query(
      `
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [sessionID, userID, hashAccessToken(rawToken), expiresAt.toISOString()],
    );
    return { rawToken, expiresAt: expiresAt.toISOString() };
  }

  private toUserSummary(row: UserRow): UserSummary {
    return {
      userID: row.id,
      displayName: row.display_name,
      role: row.role,
      adminLevel: row.admin_level ?? undefined,
      departmentID: row.department_id,
      departmentName: row.department_name,
      locale: 'zh-CN',
    };
  }
}

function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
