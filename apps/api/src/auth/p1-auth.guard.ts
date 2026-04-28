import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { MenuPermission, UserSummary } from '../common/p1-contracts';
import { P1_TOKEN_PREFIX } from './constants';
import { AuthService } from './auth.service';

export interface P1AuthenticatedRequest extends Request {
  p1SessionID?: string;
  p1UserID?: string;
  p1User?: UserSummary;
  p1MenuPermissions?: MenuPermission[];
}

@Injectable()
export class P1AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<P1AuthenticatedRequest>();
    const authorization = request.header('authorization') ?? '';
    const [scheme, token] = authorization.split(/\s+/, 2);

    if (scheme !== 'Bearer' || !token?.startsWith(`${P1_TOKEN_PREFIX}:`)) {
      throw new UnauthorizedException('unauthenticated');
    }

    const rawToken = token.slice(P1_TOKEN_PREFIX.length + 1);
    if (!rawToken) {
      throw new UnauthorizedException('unauthenticated');
    }

    const session = await this.authService.authenticateAccessToken(rawToken);
    request.p1SessionID = session.sessionID;
    request.p1UserID = session.userID;
    request.p1User = session.user;
    request.p1MenuPermissions = session.menuPermissions;
    return true;
  }
}
