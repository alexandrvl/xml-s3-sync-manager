import { isInboundObjectKey } from './fileName';

export function validateObjectKey(objectKey: string): string | null {
  const key = objectKey.trim();
  if (!key) return 'Enter an object key (destination path).';
  if (key.startsWith('/')) {
    return 'Object key must be a relative path without ".." segments.';
  }
  const parts = key.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    return 'Object key must be a relative path without empty, ".", or ".." segments.';
  }
  if (!isInboundObjectKey(key)) {
    return 'Writes must stay under IN/ (for example IN/2026/09/07/file.xml).';
  }
  return null;
}
