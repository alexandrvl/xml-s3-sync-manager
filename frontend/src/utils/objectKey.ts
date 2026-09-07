import { isInboundObjectKey } from './fileName';

export function validateObjectKey(objectKey: string): string | null {
  const key = objectKey.trim();
  if (!key) return 'Enter an object key (destination path).';
  if (key.startsWith('/') || key.includes('..')) {
    return 'Object key must be a relative path without ".." segments.';
  }
  if (!isInboundObjectKey(key)) {
    return 'Writes must stay under IN/ (for example IN/2026/09/07/file.xml).';
  }
  return null;
}
