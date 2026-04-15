import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublishingModule } from '../publishing/publishing.module';
import { AdminReadService } from './admin-read.service';
import { AdminRepository } from './admin.repository';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminWriteService } from './admin-write.service';

@Module({
  imports: [AuthModule, PublishingModule],
  controllers: [AdminController],
  providers: [
    AdminRepository,
    AdminReadService,
    AdminWriteService,
    AdminService,
  ],
})
export class AdminModule {}
