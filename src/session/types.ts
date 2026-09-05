export type AuthStrategy = 'basic' | 'oidc_implicit' | 'oidc_code' | 'demo';

export type Session = {
  strategy: AuthStrategy;
  username: string;
  sessionId: string;
  cookieName: string;
  sessionExpiresAt: number; // unix seconds
};

export const AUTH_KEYS = {
  strategy: 'mfs.auth.strategy',
  username: 'mfs.auth.username',
  password: 'mfs.auth.password',
  sessionId: 'mfs.auth.sessionId',
  cookieName: 'mfs.auth.cookieName',
  sessionExpiresAt: 'mfs.auth.sessionExpiresAt',
} as const;
