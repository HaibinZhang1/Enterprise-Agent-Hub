import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DesktopController } from './desktop.controller';
import { DesktopService } from './desktop.service';

@Module({
  imports: [AuthModule],
  controllers: [DesktopController],
  providers: [DesktopService],
})
export class DesktopModule {}
