import type { User, UserRole } from '../types';
import { readStorage, removeStorage, writeStorage } from '../utils/storage';
import { ApiError } from './errors';
import { setAccessToken } from './config';
import type {
  LoginRequest,
  PutObjectRequest,
  SessionResponse,
  StoredObject,
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
  if (key.startsWith('/')) {
    throw new ApiError(400, 'validation_error', 'Object key must be a relative path without ".." segments.');
  }
  const parts = key.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new ApiError(
      400,
      'validation_error',
      'Object key must be a relative path without empty, ".", or ".." segments.'
    );
  }
  return key;
}

function validateInboundObjectKey(objectKey: string): string {
  const key = validateObjectKey(objectKey);
  const parts = key.split('/');
  if (parts.length < 2 || parts[0] !== 'IN') {
    throw new ApiError(
      400,
      'validation_error',
      'Object key must be a relative path under IN/ (for example IN/2026/09/07/file.xml).'
    );
  }
  return key;
}

function validateReadableObjectKey(objectKey: string): string {
  const key = validateObjectKey(objectKey);
  const parts = key.split('/');
  if (parts.length < 2 || (parts[0] !== 'IN' && parts[0] !== 'OUT')) {
    throw new ApiError(400, 'validation_error', 'Object key must be a relative path under IN/ or OUT/.');
  }
  return key;
}

function matchesFolderPrefix(objectKey: string, prefix?: string): boolean {
  if (!prefix) return objectKey.startsWith('IN/');
  const folder = prefix.replace(/\/+$/, '');
  return objectKey === folder || objectKey.startsWith(`${folder}/`);
}

function loadObjects(): StoredObject[] {
  return readStorage<StoredObject[]>('api_objects', []);
}

function saveObjects(items: StoredObject[]): void {
  writeStorage('api_objects', items);
}

function nameFromEmail(email: string): string {
  const namePart = email.split('@')[0] || 'user';
  return (
    namePart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'User'
  );
}

export function createLocalApi(getRole: () => UserRole | undefined): XmlS3Api {
  return {
    mode: 'local',

    async login(request: LoginRequest, localRole: UserRole = 'Viewer'): Promise<SessionResponse> {
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
      removeStorage('api_session_user');
    },

    async me(): Promise<User> {
      const user = readStorage<User | null>('api_session_user', null);
      if (!user) {
        throw new ApiError(401, 'unauthorized', 'Not signed in.');
      }
      return user;
    },

    async putObject(request: PutObjectRequest): Promise<import('./types').SyncResult> {
      if (getRole() !== 'Administrator') {
        throw new ApiError(403, 'forbidden', 'Only administrators can sync documents.');
      }
      const objectKey = validateInboundObjectKey(request.objectKey);
      const objects = loadObjects();
      const current = objects.find((o) => o.objectKey === objectKey);
      if (request.ifMatch && current?.etag !== request.ifMatch) {
        throw new ApiError(409, 'conflict', 'Object was modified. Refresh and try again.');
      }
      const sizeBytes = new Blob([request.xmlContent]).size;
      const stored: StoredObject = {
        objectKey,
        fileName: request.fileName,
        sizeBytes,
        lastModified: new Date().toISOString(),
        etag: randomId('etag'),
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
      return {
        syncId: randomId('sync'),
        timestamp: stored.lastModified,
        objectKey: stored.objectKey,
        etag: stored.etag,
        versionId: stored.versionId,
        sizeBytes,
        storageUri: stored.storageUri,
      };
    },

    async getObject(objectKey: string): Promise<StoredObject> {
      const found = loadObjects().find((o) => o.objectKey === validateReadableObjectKey(objectKey));
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
  };
}
