import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { BadRequestException } = require("@nestjs/common");
const { AuthService } = require("../src/auth/auth.service.ts");
const { hashPassword, validatePasswordStrength } = require("../src/auth/password.ts");

test("validatePasswordStrength rejects weak passwords and accepts the default strong password", () => {
  assert.equal(validatePasswordStrength("demo123"), "密码至少需要 12 位，且必须包含大写字母、小写字母、数字和特殊字符。");
  assert.equal(validatePasswordStrength("eagenthub1234"), "密码至少需要 12 位，且必须包含大写字母、小写字母、数字和特殊字符。");
  assert.equal(validatePasswordStrength("EAgentHub123!"), null);
});

test("AuthService.changePassword updates the password hash and revokes other sessions", async () => {
  const calls = [];
  const authService = new AuthService(
    {
      async one() {
        return { password_hash: hashPassword("OldPassword123!") };
      },
      async query(text, values = []) {
        calls.push({ text, values });
      }
    },
    {
      menuPermissionsFor() {
        return [];
      }
    }
  );

  const result = await authService.changePassword("u_author", "session-current", {
    currentPassword: "OldPassword123!",
    nextPassword: "EAgentHub123!"
  });

  assert.deepEqual(result, { ok: true });
  assert.match(calls[0].text, /UPDATE users/);
  assert.equal(calls[0].values[0], "u_author");
  assert.match(calls[1].text, /id <> \$2/);
  assert.deepEqual(calls[1].values, ["u_author", "session-current"]);
});

test("AuthService.changePassword rejects weak new passwords", async () => {
  const authService = new AuthService(
    {
      async one() {
        return { password_hash: hashPassword("OldPassword123!") };
      },
      async query() {
        throw new Error("weak password should not write");
      }
    },
    {
      menuPermissionsFor() {
        return [];
      }
    }
  );

  await assert.rejects(
    () =>
      authService.changePassword("u_author", "session-current", {
        currentPassword: "OldPassword123!",
        nextPassword: "weakpass"
      }),
    BadRequestException
  );
});

test("AuthService.login returns a password-change challenge without creating a session", async () => {
  const calls = [];
  const authService = new AuthService(
    {
      async one(text) {
        assert.match(text, /password_must_change/);
        return {
          id: "u_initial",
          username: "初始用户",
          phone_number: "13800000008",
          password_hash: hashPassword("EAgentHub123!"),
          display_name: "初始用户",
          role: "normal_user",
          admin_level: null,
          department_id: "dept_frontend",
          department_name: "前端组",
          password_must_change: true
        };
      },
      async query(text, values = []) {
        calls.push({ text, values });
      }
    },
    {
      menuPermissionsFor() {
        return [];
      }
    }
  );

  const result = await authService.login({ phoneNumber: "13800000008", password: "EAgentHub123!" });

  assert.equal(result.status, "password_change_required");
  assert.equal(result.user.phoneNumber, "13800000008");
  assert.equal(typeof result.passwordChangeToken, "string");
  assert.match(calls[0].text, /auth_password_change_challenges/);
  assert.doesNotMatch(calls.map((call) => call.text).join("\n"), /auth_sessions \(id, user_id, token_hash, expires_at\)/);
});

test("AuthService.completeInitialPasswordChange updates the password, uses the token, and returns a session", async () => {
  const calls = [];
  const authService = new AuthService(
    {
      async one() {
        return {
          challenge_id: "challenge-1",
          user_id: "u_initial",
          username: "初始用户",
          phone_number: "13800000008",
          password_hash: hashPassword("EAgentHub123!"),
          display_name: "初始用户",
          role: "normal_user",
          admin_level: null,
          department_id: "dept_frontend",
          department_name: "前端组",
          password_must_change: true
        };
      },
      async query(text, values = []) {
        calls.push({ text, values });
        return { rowCount: 1 };
      }
    },
    {
      menuPermissionsFor() {
        return ["home"];
      }
    }
  );

  const result = await authService.completeInitialPasswordChange({
    passwordChangeToken: "challenge-token",
    nextPassword: "BetterPassword123!"
  });

  assert.equal(result.status, "authenticated");
  assert.equal(result.tokenType, "Bearer");
  assert.equal(result.user.phoneNumber, "13800000008");
  assert.deepEqual(result.menuPermissions, ["home"]);
  assert.match(calls[0].text, /UPDATE auth_password_change_challenges/);
  assert.match(calls[0].text, /RETURNING id/);
  assert.deepEqual(calls[0].values, ["challenge-1"]);
  assert.match(calls[1].text, /UPDATE users/);
  assert.match(calls[1].text, /password_must_change = false/);
  assert.equal(calls[1].values[0], "u_initial");
  assert.match(calls[2].text, /UPDATE auth_sessions SET revoked_at = now\(\)/);
  assert.match(calls[3].text, /INSERT INTO auth_sessions/);
});

test("AuthService.completeInitialPasswordChange rejects weak, initial, and invalid challenges", async () => {
  const challengeRow = {
    challenge_id: "challenge-1",
    user_id: "u_initial",
    username: "初始用户",
    phone_number: "13800000008",
    password_hash: hashPassword("EAgentHub123!"),
    display_name: "初始用户",
    role: "normal_user",
    admin_level: null,
    department_id: "dept_frontend",
    department_name: "前端组",
    password_must_change: true
  };

  const noWriteService = (row) =>
    new AuthService(
      {
        async one() {
          return row;
        },
        async query() {
          throw new Error("invalid initial password change should not write");
        }
      },
      {
        menuPermissionsFor() {
          return [];
        }
      }
    );

  await assert.rejects(
    () =>
      noWriteService(challengeRow).completeInitialPasswordChange({
        passwordChangeToken: "challenge-token",
        nextPassword: "weakpass"
      }),
    BadRequestException
  );
  await assert.rejects(
    () =>
      noWriteService(challengeRow).completeInitialPasswordChange({
        passwordChangeToken: "challenge-token",
        nextPassword: "EAgentHub123!"
      }),
    BadRequestException
  );
  await assert.rejects(
    () =>
      noWriteService(null).completeInitialPasswordChange({
        passwordChangeToken: "expired-or-used-token",
        nextPassword: "BetterPassword123!"
      }),
    BadRequestException
  );
});

test("AuthService.completeInitialPasswordChange rejects a challenge already claimed by another request", async () => {
  const calls = [];
  const authService = new AuthService(
    {
      async one() {
        return {
          challenge_id: "challenge-1",
          user_id: "u_initial",
          username: "初始用户",
          phone_number: "13800000008",
          password_hash: hashPassword("EAgentHub123!"),
          display_name: "初始用户",
          role: "normal_user",
          admin_level: null,
          department_id: "dept_frontend",
          department_name: "前端组",
          password_must_change: true
        };
      },
      async query(text, values = []) {
        calls.push({ text, values });
        return { rowCount: 0 };
      }
    },
    {
      menuPermissionsFor() {
        return [];
      }
    }
  );

  await assert.rejects(
    () =>
      authService.completeInitialPasswordChange({
        passwordChangeToken: "challenge-token",
        nextPassword: "BetterPassword123!"
      }),
    BadRequestException
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /UPDATE auth_password_change_challenges/);
});
