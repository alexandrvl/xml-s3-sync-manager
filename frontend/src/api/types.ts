import type { User, UserRole, ChangeType, ChangeStatus } from '../types';

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

export interface CreateDocumentRequest {
  fileName: string;
  xmlContent: string;
}

export interface UpdateDocumentRequest {
  xmlContent: string;
  version?: number;
}

export interface ApiDocument {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: string;
  version: number;
  xmlContent: string;
  status: 'local' | 'imported' | 'synced';
  objectKey?: string;
  etag?: string;
  rootTag?: string;
}

export interface CreateChangeRequest {
  changeType: ChangeType;
  nodePath: string;
  nodeTag: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description: string;
}

export interface ApiChangeEntry {
  id: string;
  timestamp: string;
  user: string;
  userEmail: string;
  nodePath: string;
  nodeTag: string;
  changeType: ChangeType;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  status: ChangeStatus;
  syncId?: string;
  description: string;
}

export interface PutObjectRequest {
  objectKey: string;
  fileName: string;
  xmlContent: string;
  documentId?: string;
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
  createDocument(request: CreateDocumentRequest): Promise<ApiDocument>;
  updateDocument(documentId: string, request: UpdateDocumentRequest): Promise<ApiDocument>;
  listDocuments(): Promise<{ items: Omit<ApiDocument, 'xmlContent'>[] }>;
  getDocument(documentId: string): Promise<ApiDocument>;
  appendChange(documentId: string, request: CreateChangeRequest): Promise<ApiChangeEntry>;
  listChanges(documentId: string): Promise<{ items: ApiChangeEntry[] }>;
  putObject(request: PutObjectRequest): Promise<SyncResult>;
  getObject(objectKey: string): Promise<StoredObject>;
  listObjects(prefix?: string, limit?: number): Promise<{ items: StoredObjectSummary[] }>;
  listSyncJobs(): Promise<{ items: SyncResult[] }>;
}
