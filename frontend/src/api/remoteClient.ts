import type { EntraPublicConfig } from '../auth/entra';
import type { User } from '../types';
import { setAccessToken } from './config';
import { apiRequest } from './http';
import type {
  ApiChangeEntry,
  ApiDocument,
  CreateChangeRequest,
  CreateDocumentRequest,
  LoginRequest,
  PutObjectRequest,
  SessionResponse,
  StoredObject,
  StoredObjectSummary,
  SyncResult,
  UpdateDocumentRequest,
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

  createDocument(request: CreateDocumentRequest): Promise<ApiDocument> {
    return apiRequest<ApiDocument>('/documents', { method: 'POST', body: request });
  },

  updateDocument(documentId: string, request: UpdateDocumentRequest): Promise<ApiDocument> {
    return apiRequest<ApiDocument>(`/documents/${encodeURIComponent(documentId)}`, {
      method: 'PUT',
      body: request,
    });
  },

  listDocuments(): Promise<{ items: Omit<ApiDocument, 'xmlContent'>[] }> {
    return apiRequest('/documents');
  },

  getDocument(documentId: string): Promise<ApiDocument> {
    return apiRequest(`/documents/${encodeURIComponent(documentId)}`);
  },

  appendChange(documentId: string, request: CreateChangeRequest): Promise<ApiChangeEntry> {
    return apiRequest(`/documents/${encodeURIComponent(documentId)}/changes`, {
      method: 'POST',
      body: request,
    });
  },

  listChanges(documentId: string): Promise<{ items: ApiChangeEntry[] }> {
    return apiRequest(`/documents/${encodeURIComponent(documentId)}/changes`);
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

  listSyncJobs(): Promise<{ items: SyncResult[] }> {
    return apiRequest('/sync-jobs');
  },
};
