export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
  permissions: string[];
}
