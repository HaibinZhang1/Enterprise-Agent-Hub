import { UserSummary } from '../common/p1-contracts';
export interface LoginRequest {
    username?: string;
    password?: string;
}
export interface LoginResponse {
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    user: UserSummary;
}
export declare class AuthService {
    login(request: LoginRequest): LoginResponse;
    logout(): {
        ok: true;
    };
}
