import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService, LoginRequest, LoginResponse } from './auth.service';
import { P1AuthenticatedRequest, P1AuthGuard } from './p1-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @UseGuards(P1AuthGuard)
  @Post('logout')
  logout(@Req() request: P1AuthenticatedRequest): Promise<{ ok: true }> {
    return this.authService.logout(request.p1SessionID ?? null);
  }
}
