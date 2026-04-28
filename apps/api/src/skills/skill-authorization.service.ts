import { ForbiddenException, Injectable } from '@nestjs/common';
import type { DetailAccess, VisibilityLevel } from '../common/p1-contracts';
import { SkillsRepository } from './skills.repository';
import type { RequesterScope, SkillAuthorization, SkillRow } from './skills.types';

@Injectable()
export class SkillAuthorizationService {
  constructor(private readonly repository: SkillsRepository) {}

  async loadRequesterScope(userID: string): Promise<RequesterScope> {
    const requester = await this.repository.loadRequesterScope(userID);
    if (!requester) {
      throw new ForbiddenException('permission_denied');
    }
    return requester;
  }

  authorizationFor(row: SkillRow, requester?: RequesterScope): SkillAuthorization {
    if (!requester) {
      const detailAccess = this.detailAccess(row.visibility_level);
      return {
        isAuthorized: row.visibility_level === 'public_installable',
        detailAccess,
      };
    }

    const scopeType = row.scope_type;
    let isAuthorized = false;
    if (!scopeType) {
      isAuthorized = row.visibility_level === 'public_installable';
    } else if (scopeType === 'all_employees') {
      isAuthorized = true;
    } else if (scopeType === 'current_department') {
      isAuthorized = (row.scope_department_ids ?? []).includes(requester.department_id);
    } else if (scopeType === 'selected_departments') {
      isAuthorized = (row.scope_department_ids ?? []).includes(requester.department_id);
    } else if (scopeType === 'department_tree') {
      isAuthorized = (row.scope_department_paths ?? []).some((path) => requester.department_path === path || requester.department_path.startsWith(`${path}/`));
    }

    if (isAuthorized) {
      return { isAuthorized, detailAccess: 'full' };
    }
    return { isAuthorized, detailAccess: this.detailAccess(row.visibility_level) };
  }

  canUpdate(row: SkillRow, requester?: RequesterScope): boolean {
    return row.status === 'published' && this.authorizationFor(row, requester).isAuthorized;
  }

  detailAccess(visibility: VisibilityLevel): DetailAccess {
    switch (visibility) {
      case 'public_installable':
      case 'detail_visible':
        return 'full';
      case 'summary_visible':
        return 'summary';
      case 'private':
      default:
        return 'none';
    }
  }
}
