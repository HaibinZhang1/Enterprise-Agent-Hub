import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  AuthLoginResponse,
  AuthService,
  ChangePasswordRequest,
  CompleteInitialPasswordChangeRequest,
  LoginResponse,
  LoginRequest,
} from './auth.service';
import { P1AuthenticatedRequest, P1AuthGuard } from './p1-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginRequest): Promise<AuthLoginResponse> {
    return this.authService.login(body);
  }

  @Post('complete-initial-password-change')
  completeInitialPasswordChange(@Body() body: CompleteInitialPasswordChangeRequest): Promise<LoginResponse> {
    return this.authService.completeInitialPasswordChange(body);
  }

  @UseGuards(P1AuthGuard)
  @Post('logout')
  logout(@Req() request: P1AuthenticatedRequest): Promise<{ ok: true }> {
    return this.authService.logout(request.p1SessionID ?? null);
  }

  @UseGuards(P1AuthGuard)
  @Post('change-password')
  changePassword(
    @Req() request: P1AuthenticatedRequest,
    @Body() body: ChangePasswordRequest,
  ): Promise<{ ok: true }> {
    return this.authService.changePassword(request.p1UserID ?? '', request.p1SessionID ?? null, body);
  }
}
