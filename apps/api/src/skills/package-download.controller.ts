import { Controller, Get, Param, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { P1AuthenticatedRequest } from '../auth/p1-auth.guard';
import { AuthService } from '../auth/auth.service';
import { SkillsService } from './skills.service';

@Controller('skill-packages')
export class PackageDownloadController {
  constructor(
    private readonly skillsService: SkillsService,
    private readonly authService: AuthService,
  ) {}

  @Get(':packageRef/download')
  async download(
    @Param('packageRef') packageRef: string,
    @Query('ticket') ticket: string | undefined,
    @Req() request: P1AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const requesterUserID = await this.resolveRequesterUserID(request.header('authorization'));
    const packageFile = await this.skillsService.downloadPackage(packageRef, ticket, requesterUserID);
    response.set({
      'content-type': packageFile.contentType,
      'content-length': String(packageFile.contentLength),
      'content-disposition': `attachment; filename="${packageFile.fileName}"`,
      'cache-control': 'private, max-age=600',
    });
    return new StreamableFile(packageFile.stream);
  }

  private async resolveRequesterUserID(authorization: string | undefined): Promise<string | null> {
    const [scheme, token] = (authorization ?? '').split(/\s+/, 2);
    if (scheme !== 'Bearer' || !token?.startsWith('p1-session:')) {
      return null;
    }
    try {
      const session = await this.authService.authenticateAccessToken(token.slice('p1-session:'.length));
      return session.userID;
    } catch {
      return null;
    }
  }
}
