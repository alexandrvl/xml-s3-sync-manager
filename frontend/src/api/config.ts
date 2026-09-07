import { readSession, removeSession, writeSession } from '../utils/storage';

const TOKEN_KEY = 'api_token';

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return configured;
}

export function isRemoteApiEnabled(): boolean {
  return getApiBaseUrl().length > 0;
}

export function getAccessToken(): string | null {
  return readSession<string | null>(TOKEN_KEY, null);
}

export function setAccessToken(token: string | null): void {
  if (token) {
    writeSession(TOKEN_KEY, token);
  } else {
    removeSession(TOKEN_KEY);
  }
}
