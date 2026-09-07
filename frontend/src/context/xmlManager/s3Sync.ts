import { S3StoredDocument, S3UploadResult } from '../../types';

export interface PutObjectApiResult {
  syncId: string;
  timestamp: string;
  objectKey: string;
  etag?: string | null;
  versionId?: string | null;
  sizeBytes: number;
  storageUri?: string | null;
}

export function toUploadResult(apiResult: PutObjectApiResult): S3UploadResult {
  return {
    syncId: apiResult.syncId,
    timestamp: apiResult.timestamp,
    key: apiResult.objectKey,
    etag: apiResult.etag ?? undefined,
    versionId: apiResult.versionId ?? undefined,
    sizeBytes: apiResult.sizeBytes,
    s3Uri: apiResult.storageUri ?? undefined,
    itemsSyncedCount: 1,
  };
}

export function toStoredDocument(params: {
  key: string;
  fileName: string;
  xml: string;
  etag?: string | null;
  versionId?: string | null;
  s3Uri?: string | null;
  sizeBytes?: number;
  lastModified?: string;
}): S3StoredDocument {
  return {
    key: params.key,
    fileName: params.fileName,
    sizeBytes: params.sizeBytes ?? new Blob([params.xml]).size,
    lastModified: params.lastModified ?? new Date().toISOString(),
    etag: params.etag ?? undefined,
    versionId: params.versionId ?? undefined,
    s3Uri: params.s3Uri ?? undefined,
    content: params.xml,
  };
}

export function upsertStoredDoc(list: S3StoredDocument[], entry: S3StoredDocument): S3StoredDocument[] {
  const idx = list.findIndex((d) => d.key === entry.key);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = entry;
    return next;
  }
  return [entry, ...list];
}
