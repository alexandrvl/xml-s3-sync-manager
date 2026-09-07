import { isRemoteApiEnabled } from './config';
import { createLocalApi } from './localClient';
import { remoteApi } from './remoteClient';
import type { XmlS3Api } from './types';
import type { UserRole } from '../types';

let currentRole: UserRole | undefined;
let localApi: XmlS3Api | null = null;

export function setApiActorRole(role: UserRole | undefined): void {
  currentRole = role;
}

export function getApi(): XmlS3Api {
  if (isRemoteApiEnabled()) {
    return remoteApi;
  }
  if (!localApi) {
    localApi = createLocalApi(() => currentRole);
  }
  return localApi;
}

export { isRemoteApiEnabled } from './config';
export { ApiError, isApiError } from './errors';
export type { XmlS3Api, PutObjectRequest, SyncResult, StoredObject } from './types';
