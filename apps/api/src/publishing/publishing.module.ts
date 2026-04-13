import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsModule } from '../skills/skills.module';
import { PublisherController } from './publisher.controller';
import { PublishingService } from './publishing.service';

@Module({
  imports: [AuthModule, SkillsModule],
  controllers: [PublisherController],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}
