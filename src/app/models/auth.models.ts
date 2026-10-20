export interface Credentials {
  username: string;
  password: string;
}

export interface User {
  username?: string;
  displayName?: string;
  [field: string]: unknown;
}

export interface LoginResponse {
  token?: unknown;
  user?: User;
}

export interface Preferences {
  theme: string;
  showTips: boolean;
  compact: boolean;
  [field: string]: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}