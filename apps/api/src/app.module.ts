import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientUpdatesModule } from './client-updates/client-updates.module';
import { validateRuntimeConfig } from './config/runtime-config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DesktopModule } from './desktop/desktop.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublishingModule } from './publishing/publishing.module';
import { SkillsModule } from './skills/skills.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateRuntimeConfig }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    ClientUpdatesModule,
    DesktopModule,
    SkillsModule,
    PublishingModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
