import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PackageDownloadController } from './package-download.controller';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [AuthModule],
  controllers: [SkillsController, PackageDownloadController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
