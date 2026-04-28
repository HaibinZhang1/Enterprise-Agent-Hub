export const phoneNumberFormatHint = "手机号需为 1 开头的 11 位数字。";

export function sanitizePhoneNumberInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 11);
}

export function validatePhoneNumber(value: string): string | null {
  const phoneNumber = value.trim();
  if (!phoneNumber) return "请输入手机号。";
  if (!/^\d+$/.test(phoneNumber)) return "手机号只能输入数字。";
  if (phoneNumber.length !== 11) return "手机号需为 11 位数字。";
  if (!phoneNumber.startsWith("1")) return "手机号需以 1 开头。";
  return null;
}
