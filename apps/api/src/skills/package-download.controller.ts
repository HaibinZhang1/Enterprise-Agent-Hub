import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { SkillsService } from './skills.service';

@Controller('skill-packages')
export class PackageDownloadController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get(':packageRef/download')
  async download(
    @Param('packageRef') packageRef: string,
    @Query('ticket') ticket: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const packageFile = await this.skillsService.downloadPackage(packageRef, ticket);
    response.set({
      'content-type': packageFile.contentType,
      'content-length': String(packageFile.contentLength),
      'content-disposition': `attachment; filename="${packageFile.fileName}"`,
      'cache-control': 'private, max-age=600',
    });
    return new StreamableFile(packageFile.stream);
  }
}
