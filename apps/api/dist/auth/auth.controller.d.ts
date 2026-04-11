import { AuthService, LoginRequest, LoginResponse } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: LoginRequest): LoginResponse;
    logout(): {
        ok: true;
    };
}
