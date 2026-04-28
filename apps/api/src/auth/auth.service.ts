import { randomBytes, createHash } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MenuPermission, UserSummary } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';
import { PermissionResolverService } from './permission-resolver.service';
import {
  INITIAL_PASSWORD,
  INITIAL_PASSWORD_REUSE_MESSAGE,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './password';
import { P1_TOKEN_PREFIX } from './constants';
import { normalizePhoneNumber } from './phone-number';

export interface LoginRequest {
  phoneNumber?: string;
  password?: string;
}

export interface LoginResponse {
  status: 'authenticated';
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: string;
  user: UserSummary;
  menuPermissions: MenuPermission[];
}

export interface PasswordChangeRequiredLoginResponse {
  status: 'password_change_required';
  passwordChangeToken: string;
  expiresAt: string;
  user: UserSummary;
}

export type AuthLoginResponse = LoginResponse | PasswordChangeRequiredLoginResponse;

export interface ChangePasswordRequest {
  currentPassword?: string;
  nextPassword?: string;
}

export interface CompleteInitialPasswordChangeRequest {
  passwordChangeToken?: string;
  nextPassword?: string;
}

export interface AuthenticatedSession {
  sessionID: string;
  userID: string;
  user: UserSummary;
  menuPermissions: MenuPermission[];
}

interface UserRow {
  id: string;
  username: string;
  phone_number: string;
  password_hash: string;
  display_name: string;
  role: 'normal_user' | 'admin';
  admin_level: number | null;
  department_id: string;
  department_name: string;
  password_must_change: boolean;
}

@Injectable()
export class AuthService {
  private readonly sessionLifetimeSeconds = 8 * 60 * 60;
  private readonly passwordChangeChallengeLifetimeSeconds = 15 * 60;

  constructor(
    private readonly database: DatabaseService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async login(request: LoginRequest): Promise<AuthLoginResponse> {
    if (!request.phoneNumber || !request.password) {
      throw new UnauthorizedException('手机号或密码不能为空');
    }
    const phoneNumber = normalizePhoneNumber(request.phoneNumber);

    const user = await this.database.one<UserRow>(
      `
      SELECT u.id, u.username, u.phone_number, u.password_hash, u.display_name, u.role, u.admin_level, u.department_id, d.name AS department_name, u.password_must_change
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.phone_number = $1 AND u.status = 'active'
      `,
      [phoneNumber],
    );

    if (!user || !verifyPassword(request.password, user.password_hash)) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const summary = this.toUserSummary(user);
    if (user.password_must_change) {
      const challenge = await this.createPasswordChangeChallenge(user.id);
      return {
        status: 'password_change_required',
        passwordChangeToken: challenge.rawToken,
        expiresAt: challenge.expiresAt,
        user: summary,
      };
    }

    return this.createAuthenticatedLoginResponse(user.id, summary);
  }

  async logout(sessionID: string | null): Promise<{ ok: true }> {
    if (sessionID) {
      await this.database.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [sessionID]);
    }
    return { ok: true };
  }

  async changePassword(
    userID: string,
    sessionID: string | null,
    request: ChangePasswordRequest,
  ): Promise<{ ok: true }> {
    const currentPassword = request.currentPassword?.trim();
    const nextPassword = request.nextPassword?.trim();
    if (!currentPassword || !nextPassword) {
      throw new BadRequestException('validation_failed');
    }

    const validationMessage = validatePasswordStrength(nextPassword);
    if (validationMessage) {
      throw new BadRequestException(validationMessage);
    }

    const user = await this.database.one<{ password_hash: string }>(
      `
      SELECT password_hash
      FROM users
      WHERE id = $1
        AND status = 'active'
      `,
      [userID],
    );
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      throw new BadRequestException('当前密码错误');
    }

    await this.database.query(
      `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
      `,
      [userID, hashPassword(nextPassword)],
    );
    await this.revokeOtherSessionsForUser(userID, sessionID);
    return { ok: true };
  }

  async completeInitialPasswordChange(request: CompleteInitialPasswordChangeRequest): Promise<LoginResponse> {
    const passwordChangeToken = request.passwordChangeToken?.trim();
    const nextPassword = request.nextPassword?.trim();
    if (!passwordChangeToken || !nextPassword) {
      throw new BadRequestException('validation_failed');
    }

    const validationMessage = validatePasswordStrength(nextPassword);
    if (validationMessage) {
      throw new BadRequestException(validationMessage);
    }

    const challenge = await this.database.one<{
      challenge_id: string;
      user_id: string;
      username: string;
      phone_number: string;
      password_hash: string;
      display_name: string;
      role: 'normal_user' | 'admin';
      admin_level: number | null;
      department_id: string;
      department_name: string;
      password_must_change: boolean;
    }>(
      `
      SELECT
        c.id AS challenge_id,
        u.id AS user_id,
        u.username,
        u.phone_number,
        u.password_hash,
        u.display_name,
        u.role,
        u.admin_level,
        u.department_id,
        d.name AS department_name,
        u.password_must_change
      FROM auth_password_change_challenges c
      JOIN users u ON u.id = c.user_id
      JOIN departments d ON d.id = u.department_id
      WHERE c.token_hash = $1
        AND c.used_at IS NULL
        AND c.expires_at > now()
        AND u.status = 'active'
      `,
      [hashAccessToken(passwordChangeToken)],
    );
    if (!challenge || !challenge.password_must_change) {
      throw new BadRequestException('password_change_token_invalid');
    }
    if (nextPassword === INITIAL_PASSWORD || verifyPassword(nextPassword, challenge.password_hash)) {
      throw new BadRequestException(INITIAL_PASSWORD_REUSE_MESSAGE);
    }

    const challengeUseResult = await this.database.query(
      `
      UPDATE auth_password_change_challenges
      SET used_at = now()
      WHERE id = $1
        AND used_at IS NULL
      RETURNING id
      `,
      [challenge.challenge_id],
    );
    if (challengeUseResult.rowCount !== 1) {
      throw new BadRequestException('password_change_token_invalid');
    }

    await this.database.query(
      `
      UPDATE users
      SET password_hash = $2,
          password_must_change = false
      WHERE id = $1
      `,
      [challenge.user_id, hashPassword(nextPassword)],
    );
    await this.revokeAllSessionsForUser(challenge.user_id);

    const user = this.toUserSummary({
      id: challenge.user_id,
      username: challenge.username,
      phone_number: challenge.phone_number,
      password_hash: challenge.password_hash,
      display_name: challenge.display_name,
      role: challenge.role,
      admin_level: challenge.admin_level,
      department_id: challenge.department_id,
      department_name: challenge.department_name,
      password_must_change: false,
    });
    return this.createAuthenticatedLoginResponse(challenge.user_id, user);
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedSession> {
    const tokenHash = hashAccessToken(token);
    const session = await this.database.one<{
      session_id: string;
      expires_at: Date;
      user_id: string;
      username: string;
      phone_number: string;
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
        u.username,
        u.phone_number,
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
      username: session.username,
      phoneNumber: session.phone_number,
      role: session.role,
      adminLevel: session.admin_level ?? undefined,
      departmentID: session.department_id,
      departmentName: session.department_name,
      locale: 'zh-CN',
    };

    return {
      sessionID: session.session_id,
      userID: session.user_id,
      user,
      menuPermissions: this.permissionResolver.menuPermissionsFor(user),
    };
  }

  async revokeAllSessionsForUser(userID: string): Promise<void> {
    await this.database.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userID]);
  }

  async revokeOtherSessionsForUser(userID: string, keepSessionID: string | null): Promise<void> {
    if (!keepSessionID) {
      await this.revokeAllSessionsForUser(userID);
      return;
    }
    await this.database.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND id <> $2',
      [userID, keepSessionID],
    );
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

  private async createPasswordChangeChallenge(userID: string): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = randomBytes(32).toString('hex');
    const challengeID = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + this.passwordChangeChallengeLifetimeSeconds * 1000);
    await this.database.query(
      `
      INSERT INTO auth_password_change_challenges (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [challengeID, userID, hashAccessToken(rawToken), expiresAt.toISOString()],
    );
    return { rawToken, expiresAt: expiresAt.toISOString() };
  }

  private async createAuthenticatedLoginResponse(userID: string, user: UserSummary): Promise<LoginResponse> {
    const session = await this.createSession(userID);
    return {
      status: 'authenticated',
      accessToken: `${P1_TOKEN_PREFIX}:${session.rawToken}`,
      tokenType: 'Bearer',
      expiresIn: this.sessionLifetimeSeconds,
      expiresAt: session.expiresAt,
      user,
      menuPermissions: this.permissionResolver.menuPermissionsFor(user),
    };
  }

  private toUserSummary(row: UserRow): UserSummary {
    return {
      username: row.username,
      phoneNumber: row.phone_number,
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
