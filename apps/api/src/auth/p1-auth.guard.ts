import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export const P1_TOKEN_PREFIX = 'p1-dev-token';

export interface P1AuthenticatedRequest extends Request {
  p1UserID?: string;
}

@Injectable()
export class P1AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<P1AuthenticatedRequest>();
    const authorization = request.header('authorization') ?? '';
    const [scheme, token] = authorization.split(/\s+/, 2);

    if (scheme !== 'Bearer' || !token?.startsWith(`${P1_TOKEN_PREFIX}:`)) {
      throw new UnauthorizedException('unauthenticated');
    }

    const userID = token.slice(P1_TOKEN_PREFIX.length + 1);
    if (!userID) {
      throw new UnauthorizedException('unauthenticated');
    }

    request.p1UserID = userID;
    return true;
  }
}
