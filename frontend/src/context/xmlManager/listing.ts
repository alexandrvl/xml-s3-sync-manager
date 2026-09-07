import { S3StoredDocument } from '../../types';

export interface ListedObject {
  objectKey: string;
  fileName: string;
  sizeBytes: number;
  lastModified: string;
  etag?: string | null;
  versionId?: string | null;
  storageUri?: string | null;
}

export function summariesToStoredDocs(items: ListedObject[]): S3StoredDocument[] {
  return items.map((item) => ({
    key: item.objectKey,
    fileName: item.fileName,
    sizeBytes: item.sizeBytes,
    lastModified: item.lastModified,
    etag: item.etag ?? undefined,
    versionId: item.versionId ?? undefined,
    s3Uri: item.storageUri ?? undefined,
    content: '',
  }));
}

export function sortListedByLastModified(items: ListedObject[]): ListedObject[] {
  return [...items].sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified));
}

export function mergeListedByKey(lists: ListedObject[][]): ListedObject[] {
  const byKey = new Map<string, ListedObject>();
  for (const list of lists) {
    for (const item of list) {
      byKey.set(item.objectKey, item);
    }
  }
  return sortListedByLastModified([...byKey.values()]);
}

export function filterListedByNameQuery(items: ListedObject[], query: string): ListedObject[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const fileName = item.fileName.toLowerCase();
    const key = item.objectKey.toLowerCase();
    return fileName.includes(q) || key.includes(q);
  });
}

export function cachedXmlFor(item: ListedObject, previous: S3StoredDocument[]): string {
  const prev = previous.find((doc) => doc.key === item.objectKey);
  if (!prev?.content) return '';
  const listedEtag = item.etag ?? undefined;
  if (listedEtag && prev.etag && listedEtag !== prev.etag) return '';
  return prev.content;
}

export function storedDocsWithCachedXml(items: ListedObject[], previous: S3StoredDocument[]): S3StoredDocument[] {
  return summariesToStoredDocs(items).map((doc, index) => ({
    ...doc,
    content: cachedXmlFor(items[index], previous),
  }));
}
