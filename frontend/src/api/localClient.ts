import type { User, UserRole } from '../types';
import { readStorage, writeStorage } from '../utils/storage';
import { ApiError } from './errors';
import { setAccessToken } from './config';
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

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function validateObjectKey(objectKey: string): string {
  const key = objectKey.trim();
  if (!key) {
    throw new ApiError(400, 'validation_error', 'Enter an object key (destination path).');
  }
  if (key.startsWith('/') || key.includes('..')) {
    throw new ApiError(400, 'validation_error', 'Object key must be a relative path without ".." segments.');
  }
  return key;
}

function validateInboundObjectKey(objectKey: string): string {
  const key = validateObjectKey(objectKey);
  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] !== 'IN') {
    throw new ApiError(
      400,
      'validation_error',
      'Object key must be a relative path under IN/ (for example IN/2026/09/07/file.xml).'
    );
  }
  return key;
}

function matchesFolderPrefix(objectKey: string, prefix?: string): boolean {
  if (!prefix) return true;
  const folder = prefix.replace(/\/+$/, '');
  return objectKey === folder || objectKey.startsWith(`${folder}/`);
}

function loadDocs(): ApiDocument[] {
  return readStorage<ApiDocument[]>('api_documents', []);
}

function saveDocs(docs: ApiDocument[]): void {
  writeStorage('api_documents', docs);
}

function loadObjects(): StoredObject[] {
  return readStorage<StoredObject[]>('api_objects', []);
}

function saveObjects(items: StoredObject[]): void {
  writeStorage('api_objects', items);
}

function loadChanges(): Record<string, ApiChangeEntry[]> {
  return readStorage<Record<string, ApiChangeEntry[]>>('api_changes', {});
}

function saveChanges(map: Record<string, ApiChangeEntry[]>): void {
  writeStorage('api_changes', map);
}

function loadJobs(): SyncResult[] {
  return readStorage<SyncResult[]>('api_sync_jobs', []);
}

function saveJobs(items: SyncResult[]): void {
  writeStorage('api_sync_jobs', items);
}

function nameFromEmail(email: string): string {
  const namePart = email.split('@')[0] || 'user';
  return namePart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'User';
}

export function createLocalApi(getRole: () => UserRole | undefined): XmlS3Api {
  return {
    mode: 'local',

    async login(request: LoginRequest, localRole: UserRole = 'Administrator'): Promise<SessionResponse> {
      const email = request.email.trim().toLowerCase();
      if (!email.includes('@')) {
        throw new ApiError(400, 'validation_error', 'Enter a valid email address.');
      }
      const user: User = {
        id: randomId('usr'),
        name: nameFromEmail(email),
        email,
        role: localRole,
        authProvider: 'local',
      };
      const token = randomId('tok');
      setAccessToken(token);
      writeStorage('api_session_user', user);
      return { token, tokenType: 'Bearer', user };
    },

    async logout(): Promise<void> {
      setAccessToken(null);
    },

    async me(): Promise<User> {
      const user = readStorage<User | null>('api_session_user', null);
      if (!user) {
        throw new ApiError(401, 'unauthorized', 'Not signed in.');
      }
      return user;
    },

    async createDocument(request: CreateDocumentRequest): Promise<ApiDocument> {
      const docs = loadDocs();
      const doc: ApiDocument = {
        id: randomId('doc'),
        fileName: request.fileName,
        fileSize: new Blob([request.xmlContent]).size,
        lastModified: new Date().toISOString(),
        version: 1,
        xmlContent: request.xmlContent,
        status: 'imported',
      };
      saveDocs([doc, ...docs]);
      return doc;
    },

    async updateDocument(documentId: string, request: UpdateDocumentRequest): Promise<ApiDocument> {
      const docs = loadDocs();
      const idx = docs.findIndex((d) => d.id === documentId);
      if (idx < 0) {
        throw new ApiError(404, 'not_found', 'Document not found.');
      }
      const current = docs[idx];
      const next: ApiDocument = {
        ...current,
        xmlContent: request.xmlContent,
        fileSize: new Blob([request.xmlContent]).size,
        version: current.version + 1,
        lastModified: new Date().toISOString(),
      };
      docs[idx] = next;
      saveDocs(docs);
      return next;
    },

    async listDocuments() {
      return {
        items: loadDocs().map(({ xmlContent: _xml, ...rest }) => rest),
      };
    },

    async getDocument(documentId: string): Promise<ApiDocument> {
      const found = loadDocs().find((d) => d.id === documentId);
      if (!found) {
        throw new ApiError(404, 'not_found', 'Document not found.');
      }
      return found;
    },

    async appendChange(documentId: string, request: CreateChangeRequest): Promise<ApiChangeEntry> {
      const map = loadChanges();
      const user = readStorage<User | null>('auth_user', null);
      const entry: ApiChangeEntry = {
        id: randomId('chg'),
        timestamp: new Date().toISOString(),
        user: user?.name || 'Local Editor',
        userEmail: user?.email || 'editor@local',
        nodePath: request.nodePath,
        nodeTag: request.nodeTag,
        changeType: request.changeType,
        fieldName: request.fieldName,
        oldValue: request.oldValue,
        newValue: request.newValue,
        status: 'pending',
        description: request.description,
      };
      map[documentId] = [entry, ...(map[documentId] || [])];
      saveChanges(map);
      return entry;
    },

    async listChanges(documentId: string) {
      return { items: loadChanges()[documentId] || [] };
    },

    async putObject(request: PutObjectRequest): Promise<SyncResult> {
      if (getRole() !== 'Administrator') {
        throw new ApiError(403, 'forbidden', 'Only administrators can sync documents.');
      }
      const objectKey = validateInboundObjectKey(request.objectKey);
      const objects = loadObjects();
      const sizeBytes = new Blob([request.xmlContent]).size;
      const stored: StoredObject = {
        objectKey,
        fileName: request.fileName,
        sizeBytes,
        lastModified: new Date().toISOString(),
        etag: `"${randomId('etag')}"`,
        versionId: randomId('v'),
        storageUri: `storage://${objectKey}`,
        xmlContent: request.xmlContent,
      };
      const idx = objects.findIndex((o) => o.objectKey === stored.objectKey);
      if (idx >= 0) {
        objects[idx] = stored;
      } else {
        objects.unshift(stored);
      }
      saveObjects(objects);

      const result: SyncResult = {
        syncId: randomId('sync'),
        timestamp: stored.lastModified,
        objectKey: stored.objectKey,
        etag: stored.etag,
        versionId: stored.versionId,
        sizeBytes,
        storageUri: stored.storageUri,
      };
      saveJobs([result, ...loadJobs()]);
      return result;
    },

    async getObject(objectKey: string): Promise<StoredObject> {
      const found = loadObjects().find((o) => o.objectKey === objectKey);
      if (!found) {
        throw new ApiError(404, 'not_found', `Object not found: ${objectKey}`);
      }
      return found;
    },

    async listObjects(prefix?: string, limit?: number) {
      const items = loadObjects()
        .filter((o) => matchesFolderPrefix(o.objectKey, prefix))
        .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
        .slice(0, limit ?? Number.POSITIVE_INFINITY)
        .map(({ xmlContent: _xml, ...summary }) => summary);
      return { items };
    },

    async listSyncJobs() {
      return { items: loadJobs() };
    },
  };
}
