import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MenuPermission } from '../common/p1-contracts';
import { P1AuthenticatedRequest } from './p1-auth.guard';
import { REQUIRE_MENU_PERMISSION } from './require-menu-permission.decorator';

@Injectable()
export class MenuPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MenuPermission[]>(REQUIRE_MENU_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<P1AuthenticatedRequest>();
    const granted = new Set(request.p1MenuPermissions ?? []);
    const allowed = required.every((permission) => granted.has(permission));
    if (!allowed) {
      throw new ForbiddenException('permission_denied');
    }
    return true;
  }
}
