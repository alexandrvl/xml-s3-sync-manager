import { readStorage, removeStorage, writeStorage } from '../utils/storage';

const TOKEN_KEY = 'api_token';

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return configured;
}

export function isRemoteApiEnabled(): boolean {
  return getApiBaseUrl().length > 0;
}

export function getAccessToken(): string | null {
  return readStorage<string | null>(TOKEN_KEY, null);
}

export function setAccessToken(token: string | null): void {
  if (token) {
    writeStorage(TOKEN_KEY, token);
  } else {
    removeStorage(TOKEN_KEY);
  }
}
