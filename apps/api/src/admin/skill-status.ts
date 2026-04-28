import { BadRequestException } from '@nestjs/common';
import { SkillStatus } from '../common/p1-contracts';

export function assertSkillStatusTransition(
  currentStatus: SkillStatus,
  nextStatus: SkillStatus,
): void {
  if (nextStatus === 'published' && currentStatus !== 'delisted') {
    throw new BadRequestException('validation_failed');
  }
  if (nextStatus === 'delisted' && currentStatus !== 'published') {
    throw new BadRequestException('validation_failed');
  }
  if (nextStatus === 'archived' && currentStatus === 'archived') {
    throw new BadRequestException('validation_failed');
  }
}
