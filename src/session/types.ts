export type AuthStrategy = 'basic' | 'oidc_implicit' | 'oidc_code' | 'demo';

export type Session = {
  strategy: AuthStrategy;
  username: string;
  email: string;
  employeeId: string;
  sessionId: string;
  cookieName: string;
  sessionExpiresAt: number; // unix seconds
  routeId?: string;
  routeIds?: string[];
  region?: string;
  storeId?: string;
};

export const AUTH_KEYS = {
  strategy: 'mfs.auth.strategy',
  username: 'mfs.auth.username',
  email: 'mfs.auth.email',
  employeeId: 'mfs.auth.employeeId',
  password: 'mfs.auth.password',
  sessionId: 'mfs.auth.sessionId',
  cookieName: 'mfs.auth.cookieName',
  sessionExpiresAt: 'mfs.auth.sessionExpiresAt',
} as const;
