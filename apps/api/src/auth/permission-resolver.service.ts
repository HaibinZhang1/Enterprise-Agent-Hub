import { Injectable } from '@nestjs/common';
import { MenuPermission, UserSummary } from '../common/p1-contracts';

const basePermissions: MenuPermission[] = [
  'home',
  'market',
  'my_installed',
  'tools',
  'projects',
  'notifications',
  'settings',
];

const adminPermissions: MenuPermission[] = ['review', 'manage'];

@Injectable()
export class PermissionResolverService {
  menuPermissionsFor(user: UserSummary): MenuPermission[] {
    if (user.role !== 'admin') {
      return [...basePermissions];
    }
    return [...basePermissions.slice(0, 3), ...adminPermissions, ...basePermissions.slice(3)];
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
      publishSkill: false,
      reviewWorkbench: isAdmin,
      adminManage: isAdmin,
      mcpManage: false,
      pluginManage: false,
    };
  }
}
