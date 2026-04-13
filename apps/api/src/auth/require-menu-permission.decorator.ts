import { SetMetadata } from '@nestjs/common';
import { MenuPermission } from '../common/p1-contracts';

export const REQUIRE_MENU_PERMISSION = 'require-menu-permission';

export const RequireMenuPermission = (...permissions: MenuPermission[]) =>
  SetMetadata(REQUIRE_MENU_PERMISSION, permissions);
