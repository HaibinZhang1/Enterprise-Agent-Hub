import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientUpdateStorageService } from './client-update-storage.service';
import { ClientUpdatesAdminController } from './client-updates-admin.controller';
import { ClientUpdatesController } from './client-updates.controller';
import { ClientUpdatesRepository } from './client-updates.repository';
import { ClientUpdatesService } from './client-updates.service';

@Module({
  imports: [AuthModule],
  controllers: [ClientUpdatesController, ClientUpdatesAdminController],
  providers: [ClientUpdatesService, ClientUpdatesRepository, ClientUpdateStorageService],
})
export class ClientUpdatesModule {}
