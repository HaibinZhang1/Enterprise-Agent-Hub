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
