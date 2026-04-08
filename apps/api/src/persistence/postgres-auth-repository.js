// @ts-nocheck
import { randomUUID } from 'node:crypto';

import { execSql, queryMany, queryOne, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function mapUser(row) {
  return row
    ? Object.freeze({
        userId: row.userId,
        username: row.username,
        departmentId: row.departmentId ?? null,
        roleCode: row.roleCode,
        status: row.status,
        authzVersion: Number(row.authzVersion),
        authzRecalcPending: Boolean(row.authzRecalcPending),
        pendingAuthzVersion: row.pendingAuthzVersion === null ? null : Number(row.pendingAuthzVersion),
        mustChangePassword: Boolean(row.mustChangePassword),
        lastLoginAt: row.lastLoginAt ?? null,
        provider: row.provider,
      })
    : null;
}

function mapCredential(row) {
  return row
    ? Object.freeze({
        userId: row.userId,
        password: row.password,
        passwordHistory: Object.freeze([...(row.passwordHistory ?? [])]),
        temporaryCredentialMode: row.temporaryCredentialMode,
        failedAttemptCount: Number(row.failedAttemptCount),
        lockedUntil: row.lockedUntil ?? null,
        passwordChangedAt: row.passwordChangedAt,
      })
    : null;
}

function mapSession(row) {
  return row
    ? Object.freeze({
        sessionId: row.sessionId,
        userId: row.userId,
        sessionFamilyId: row.sessionFamilyId,
        parentSessionId: row.parentSessionId ?? null,
        clientType: row.clientType,
        deviceLabel: row.deviceLabel,
        refreshTokenHash: row.refreshTokenHash,
        issuedAuthzVersion: Number(row.issuedAuthzVersion),
        issuedAt: row.issuedAt,
        lastSeenAt: row.lastSeenAt,
        expiresAt: row.expiresAt,
        idleExpiresAt: row.idleExpiresAt,
        revokedAt: row.revokedAt ?? null,
        revokeReason: row.revokeReason ?? null,
      })
    : null;
}

export function createPostgresAuthRepository(input) {
  const databaseUrl = input.databaseUrl;

  function selectUser(whereSql) {
    return mapUser(
      queryOne(
        databaseUrl,
        `
          select
            id::text as "userId",
            username,
            department_id::text as "departmentId",
            role_code as "roleCode",
            status,
            authz_version as "authzVersion",
            authz_recalc_pending as "authzRecalcPending",
            authz_target_version as "pendingAuthzVersion",
            must_change_password as "mustChangePassword",
            last_login_at::text as "lastLoginAt",
            provider
          from auth.users
          where ${whereSql}
        `,
      ),
    );
  }

  function selectCredential(whereSql) {
    return mapCredential(
      queryOne(
        databaseUrl,
        `
          select
            user_id::text as "userId",
            password,
            password_history as "passwordHistory",
            temporary_credential_mode as "temporaryCredentialMode",
            failed_attempt_count as "failedAttemptCount",
            locked_until::text as "lockedUntil",
            password_changed_at::text as "passwordChangedAt"
          from auth.credentials
          where ${whereSql}
        `,
      ),
    );
  }

  function selectSession(whereSql) {
    return mapSession(
      queryOne(
        databaseUrl,
        `
          select
            id::text as "sessionId",
            user_id::text as "userId",
            session_family_id::text as "sessionFamilyId",
            parent_session_id::text as "parentSessionId",
            client_type as "clientType",
            device_label as "deviceLabel",
            refresh_token_hash as "refreshTokenHash",
            issued_authz_version as "issuedAuthzVersion",
            issued_at::text as "issuedAt",
            last_seen_at::text as "lastSeenAt",
            expires_at::text as "expiresAt",
            idle_expires_at::text as "idleExpiresAt",
            revoked_at::text as "revokedAt",
            revoke_reason as "revokeReason"
          from auth.sessions
          where ${whereSql}
        `,
      ),
    );
  }

  return Object.freeze({
    createUser(user) {
      execSql(
        databaseUrl,
        `
          insert into auth.users (
            id, username, display_name, department_id, role_code, status, provider,
            must_change_password, authz_version, authz_recalc_pending, authz_target_version,
            authz_pending_reason, last_login_at
          ) values (
            ${sqlUuid(user.userId)},
            ${sqlLiteral(user.username)},
            ${sqlLiteral(user.username)},
            ${sqlUuid(user.departmentId)},
            ${sqlLiteral(user.roleCode)},
            ${sqlLiteral(user.status)},
            ${sqlLiteral(user.provider)},
            ${user.mustChangePassword ? 'true' : 'false'},
            ${Number(user.authzVersion)},
            ${user.authzRecalcPending ? 'true' : 'false'},
            ${user.pendingAuthzVersion === null ? 'null' : Number(user.pendingAuthzVersion)},
            null,
            ${user.lastLoginAt ? sqlLiteral(user.lastLoginAt) + '::timestamptz' : 'null'}
          )
          on conflict (id) do update set
            username = excluded.username,
            display_name = excluded.display_name,
            department_id = excluded.department_id,
            role_code = excluded.role_code,
            status = excluded.status,
            provider = excluded.provider,
            must_change_password = excluded.must_change_password,
            authz_version = excluded.authz_version,
            authz_recalc_pending = excluded.authz_recalc_pending,
            authz_target_version = excluded.authz_target_version,
            last_login_at = excluded.last_login_at
        `,
      );
      return this.findUserById(user.userId);
    },

    updateUser(user) {
      return this.createUser(user);
    },

    findUserById(userId) {
      return selectUser(`id = ${sqlUuid(userId)}`);
    },

    findUserByUsername(username) {
      return selectUser(`username = ${sqlLiteral(username)}`);
    },

    listUsers() {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              id::text as "userId",
              username,
              department_id::text as "departmentId",
              role_code as "roleCode",
              status,
              authz_version as "authzVersion",
              authz_recalc_pending as "authzRecalcPending",
              authz_target_version as "pendingAuthzVersion",
              must_change_password as "mustChangePassword",
              last_login_at::text as "lastLoginAt",
              provider
            from auth.users
            order by username asc
          `,
        ).map(mapUser),
      );
    },

    saveCredential(credential) {
      execSql(
        databaseUrl,
        `
          insert into auth.credentials (
            user_id, password, password_history, temporary_credential_mode,
            failed_attempt_count, locked_until, password_changed_at
          ) values (
            ${sqlUuid(credential.userId)},
            ${sqlLiteral(credential.password)},
            ${sqlJson(credential.passwordHistory ?? [])},
            ${sqlLiteral(credential.temporaryCredentialMode)},
            ${Number(credential.failedAttemptCount)},
            ${credential.lockedUntil ? sqlLiteral(credential.lockedUntil) + '::timestamptz' : 'null'},
            ${sqlLiteral(credential.passwordChangedAt)}::timestamptz
          )
          on conflict (user_id) do update set
            password = excluded.password,
            password_history = excluded.password_history,
            temporary_credential_mode = excluded.temporary_credential_mode,
            failed_attempt_count = excluded.failed_attempt_count,
            locked_until = excluded.locked_until,
            password_changed_at = excluded.password_changed_at
        `,
      );
      return this.getCredential(credential.userId);
    },

    getCredential(userId) {
      return selectCredential(`user_id = ${sqlUuid(userId)}`);
    },

    nextSessionId() {
      return randomUUID();
    },

    saveSession(session) {
      execSql(
        databaseUrl,
        `
          insert into auth.sessions (
            id, user_id, session_family_id, parent_session_id, client_type, device_label,
            refresh_token_hash, issued_authz_version, issued_at, last_seen_at, expires_at,
            idle_expires_at, revoked_at, revoke_reason
          ) values (
            ${sqlUuid(session.sessionId)},
            ${sqlUuid(session.userId)},
            ${sqlUuid(session.sessionFamilyId)},
            ${sqlUuid(session.parentSessionId)},
            ${sqlLiteral(session.clientType)},
            ${sqlLiteral(session.deviceLabel)},
            ${sqlLiteral(session.refreshTokenHash)},
            ${Number(session.issuedAuthzVersion)},
            ${sqlLiteral(session.issuedAt)}::timestamptz,
            ${sqlLiteral(session.lastSeenAt)}::timestamptz,
            ${sqlLiteral(session.expiresAt)}::timestamptz,
            ${sqlLiteral(session.idleExpiresAt)}::timestamptz,
            ${session.revokedAt ? sqlLiteral(session.revokedAt) + '::timestamptz' : 'null'},
            ${sqlLiteral(session.revokeReason)}
          )
          on conflict (id) do update set
            user_id = excluded.user_id,
            session_family_id = excluded.session_family_id,
            parent_session_id = excluded.parent_session_id,
            client_type = excluded.client_type,
            device_label = excluded.device_label,
            refresh_token_hash = excluded.refresh_token_hash,
            issued_authz_version = excluded.issued_authz_version,
            issued_at = excluded.issued_at,
            last_seen_at = excluded.last_seen_at,
            expires_at = excluded.expires_at,
            idle_expires_at = excluded.idle_expires_at,
            revoked_at = excluded.revoked_at,
            revoke_reason = excluded.revoke_reason
        `,
      );
      return this.getSession(session.sessionId);
    },

    getSession(sessionId) {
      return selectSession(`id = ${sqlUuid(sessionId)}`);
    },

    listSessionsByUserId(userId) {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              id::text as "sessionId",
              user_id::text as "userId",
              session_family_id::text as "sessionFamilyId",
              parent_session_id::text as "parentSessionId",
              client_type as "clientType",
              device_label as "deviceLabel",
              refresh_token_hash as "refreshTokenHash",
              issued_authz_version as "issuedAuthzVersion",
              issued_at::text as "issuedAt",
              last_seen_at::text as "lastSeenAt",
              expires_at::text as "expiresAt",
              idle_expires_at::text as "idleExpiresAt",
              revoked_at::text as "revokedAt",
              revoke_reason as "revokeReason"
            from auth.sessions
            where user_id = ${sqlUuid(userId)}
            order by issued_at desc
          `,
        ).map(mapSession),
      );
    },

    listActiveSessionsByUserId(userId) {
      return Object.freeze(this.listSessionsByUserId(userId).filter((session) => session.revokedAt === null));
    },

    revokeUserSessions(input) {
      execSql(
        databaseUrl,
        `
          update auth.sessions
          set revoked_at = ${sqlLiteral(input.revokedAt)}::timestamptz,
              revoke_reason = ${sqlLiteral(input.revokeReason)}
          where user_id = ${sqlUuid(input.userId)}
            and revoked_at is null
        `,
      );
      return this.listSessionsByUserId(input.userId).filter((session) => session.revokedAt === input.revokedAt);
    },
  });
}
