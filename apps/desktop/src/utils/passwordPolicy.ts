export const passwordPolicyHint = "密码至少需要 12 位，且必须包含大写字母、小写字母、数字和特殊字符。";

export function validatePasswordPolicy(password: string): string | null {
  const trimmed = password.trim();
  if (!trimmed) {
    return "请输入密码。";
  }
  if (trimmed.length < 12) {
    return passwordPolicyHint;
  }
  if (!/[A-Z]/.test(trimmed) || !/[a-z]/.test(trimmed) || !/\d/.test(trimmed) || !/[^A-Za-z0-9]/.test(trimmed)) {
    return passwordPolicyHint;
  }
  return null;
}
