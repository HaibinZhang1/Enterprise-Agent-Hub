import { BadRequestException } from '@nestjs/common';

const mainlandPhoneNumberPattern = /^1[0-9]{10}$/;

export function normalizePhoneNumber(value: string | undefined, message = '手机号需为 1 开头的 11 位数字'): string {
  const phoneNumber = value?.trim() ?? '';
  if (!mainlandPhoneNumberPattern.test(phoneNumber)) {
    throw new BadRequestException(message);
  }
  return phoneNumber;
}
