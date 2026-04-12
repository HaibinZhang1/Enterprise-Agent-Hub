import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { P1AuthGuard } from './p1-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, P1AuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
