import type { User, UserRole } from '../types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SessionResponse {
  token: string;
  tokenType: 'Bearer';
  expiresInSeconds?: number;
  user: User;
}

export interface PutObjectRequest {
  objectKey: string;
  fileName: string;
  xmlContent: string;
  ifMatch?: string;
}

export interface StoredObject {
  objectKey: string;
  fileName: string;
  sizeBytes: number;
  lastModified: string;
  etag?: string;
  versionId?: string;
  storageUri?: string;
  xmlContent: string;
}

export interface StoredObjectSummary {
  objectKey: string;
  fileName: string;
  sizeBytes: number;
  lastModified: string;
  etag?: string;
  versionId?: string;
  storageUri?: string;
}

export interface SyncResult {
  syncId: string;
  timestamp: string;
  objectKey: string;
  etag?: string;
  versionId?: string;
  sizeBytes: number;
  storageUri?: string;
}

export interface XmlS3Api {
  readonly mode: 'remote' | 'local';
  getAuthConfig?(): Promise<import('../auth/entra').EntraPublicConfig>;
  login(request: LoginRequest, localRole?: UserRole): Promise<SessionResponse>;
  logout(): Promise<void>;
  me(): Promise<User>;
  putObject(request: PutObjectRequest): Promise<SyncResult>;
  getObject(objectKey: string): Promise<StoredObject>;
  listObjects(prefix?: string, limit?: number): Promise<{ items: StoredObjectSummary[] }>;
}
