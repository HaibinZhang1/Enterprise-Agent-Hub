import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MenuPermissionGuard } from './menu-permission.guard';
import { PermissionResolverService } from './permission-resolver.service';
import { P1AuthGuard } from './p1-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PermissionResolverService, P1AuthGuard, MenuPermissionGuard, Reflector],
  exports: [AuthService, PermissionResolverService, P1AuthGuard, MenuPermissionGuard],
})
export class AuthModule {}
