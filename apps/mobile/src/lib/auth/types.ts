export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
  deviceId: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}
