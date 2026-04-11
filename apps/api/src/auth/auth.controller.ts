import { Body, Controller, Post } from '@nestjs/common';
import { AuthService, LoginRequest, LoginResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginRequest): LoginResponse {
    return this.authService.login(body);
  }

  @Post('logout')
  logout(): { ok: true } {
    return this.authService.logout();
  }
}
