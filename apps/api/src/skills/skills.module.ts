import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PackageStorageService } from '../publishing/package-storage.service';
import { PackageDownloadController } from './package-download.controller';
import { PackageDownloadService } from './package-download.service';
import { SkillAuthorizationService } from './skill-authorization.service';
import { SkillQueryService } from './skill-query.service';
import { SkillsController } from './skills.controller';
import { SkillsRepository } from './skills.repository';
import { SkillsService } from './skills.service';

@Module({
  imports: [AuthModule],
  controllers: [SkillsController, PackageDownloadController],
  providers: [SkillsService, SkillsRepository, SkillAuthorizationService, SkillQueryService, PackageDownloadService, PackageStorageService],
  exports: [SkillsService],
})
export class SkillsModule {}
