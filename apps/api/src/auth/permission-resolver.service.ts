import { Injectable } from '@nestjs/common';
import { MenuPermission, UserSummary } from '../common/p1-contracts';

const basePermissions: MenuPermission[] = [
  'home',
  'market',
  'my_installed',
  'publisher',
  'target_management',
  'notifications',
];

const adminPermissions: MenuPermission[] = [
  'review',
  'admin_departments',
  'admin_users',
  'admin_skills',
];

const adminBasePermissions: MenuPermission[] = [
  'home',
  'market',
  'my_installed',
  'publisher',
  'target_management',
  'notifications',
];

@Injectable()
export class PermissionResolverService {
  menuPermissionsFor(user: UserSummary): MenuPermission[] {
    if (user.role !== 'admin') {
      return [...basePermissions];
    }
    return [...adminBasePermissions, ...adminPermissions];
  }

  navigationFor(user: UserSummary): MenuPermission[] {
    return this.menuPermissionsFor(user);
  }

  featureFlagsFor(user: UserSummary): {
    p1Desktop: boolean;
    publishSkill: boolean;
    reviewWorkbench: boolean;
    adminManage: boolean;
    mcpManage: boolean;
    pluginManage: boolean;
  } {
    const isAdmin = user.role === 'admin';
    return {
      p1Desktop: true,
      publishSkill: true,
      reviewWorkbench: isAdmin,
      adminManage: isAdmin,
      mcpManage: false,
      pluginManage: false,
    };
  }
}
