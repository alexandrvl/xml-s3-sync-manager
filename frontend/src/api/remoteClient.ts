import type { EntraPublicConfig } from '../auth/entra';
import type { User } from '../types';
import { setAccessToken } from './config';
import { apiRequest } from './http';
import type {
  LoginRequest,
  PutObjectRequest,
  SessionResponse,
  StoredObject,
  StoredObjectSummary,
  SyncResult,
  XmlS3Api,
} from './types';

export const remoteApi: XmlS3Api = {
  mode: 'remote',

  async getAuthConfig(): Promise<EntraPublicConfig> {
    return apiRequest<EntraPublicConfig>('/auth/config', { auth: false });
  },

  async login(request: LoginRequest): Promise<SessionResponse> {
    const session = await apiRequest<SessionResponse>('/auth/login', {
      method: 'POST',
      body: request,
      auth: false,
    });
    setAccessToken(session.token);
    return session;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
    }
  },

  me(): Promise<User> {
    return apiRequest<User>('/auth/me');
  },

  putObject(request: PutObjectRequest): Promise<SyncResult> {
    return apiRequest('/objects', { method: 'PUT', body: request });
  },

  getObject(objectKey: string): Promise<StoredObject> {
    return apiRequest('/objects/content', { query: { key: objectKey } });
  },

  listObjects(prefix?: string, limit?: number): Promise<{ items: StoredObjectSummary[] }> {
    return apiRequest('/objects', { query: { prefix, limit } });
  },
};
