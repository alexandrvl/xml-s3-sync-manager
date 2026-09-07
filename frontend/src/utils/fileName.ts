export const INBOUND_ROOT = 'IN';
export const OUTBOUND_ROOT = 'OUT';

export function normalizeXmlFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const withoutPath = trimmed.replace(/\\/g, '/').split('/').pop() || '';
  if (!withoutPath || withoutPath === '.' || withoutPath === '..') return '';
  return withoutPath.toLowerCase().endsWith('.xml') ? withoutPath : `${withoutPath}.xml`;
}

export function validateNewXmlFileName(
  name: string,
  usedNames: Iterable<string>,
  options?: { mustDifferFrom?: string }
): { fileName: string } | { error: string } {
  const fileName = normalizeXmlFileName(name);
  if (!fileName) {
    return { error: 'Enter a file name.' };
  }
  if (/[<>:"|?*\u0000-\u001f]/.test(fileName)) {
    return { error: 'File name contains invalid characters.' };
  }
  const lower = fileName.toLowerCase();
  if (options?.mustDifferFrom && options.mustDifferFrom.toLowerCase() === lower) {
    return { error: 'Name must be different from the existing XML file.' };
  }
  for (const used of usedNames) {
    if (used.toLowerCase() === lower) {
      return { error: `A document named "${fileName}" already exists. Choose a different name.` };
    }
  }
  return { fileName };
}

export function suggestUniqueXmlFileName(sourceFileName: string, usedNames: Iterable<string>): string {
  const used = new Set(
    [...usedNames, sourceFileName].map((n) => n.toLowerCase()).filter(Boolean)
  );
  const base = sourceFileName.replace(/\.xml$/i, '') || 'document';
  let candidate = `${base}-copy.xml`;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-copy-${i}.xml`;
    i += 1;
  }
  return candidate;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function inboundYearStamp(now = new Date()): string {
  return String(now.getFullYear());
}

/** Zero-padded calendar month (`09`) for `IN/2026/09/07/...` keys. */
export function inboundMonthStamp(now = new Date()): string {
  return pad2(now.getMonth() + 1);
}

/** Zero-padded calendar day (`07`) for `IN/2026/09/07/...` keys. */
export function inboundDayStamp(now = new Date()): string {
  return pad2(now.getDate());
}

export function datedRootFolder(root: string, now = new Date()): string {
  return `${root}/${inboundYearStamp(now)}/${inboundMonthStamp(now)}/${inboundDayStamp(now)}`;
}

export function inboundFolder(now = new Date()): string {
  return datedRootFolder(INBOUND_ROOT, now);
}

export function outboundFolder(now = new Date()): string {
  return datedRootFolder(OUTBOUND_ROOT, now);
}

export function inboundObjectKey(fileName: string, now = new Date()): string {
  const name = normalizeXmlFileName(fileName) || 'document.xml';
  return `${inboundFolder(now)}/${name}`;
}

export function isInboundObjectKey(objectKey: string): boolean {
  const key = objectKey.trim();
  if (!key || key.startsWith('/') || key.includes('..')) return false;
  const parts = key.split('/').filter(Boolean);
  return parts.length >= 2 && parts[0] === INBOUND_ROOT;
}

export function parentFoldersForKey(objectKey: string): string[] {
  const parts = objectKey.trim().replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts.length < 2) return [];
  const folders: string[] = [];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    folders.push(acc);
  }
  return folders;
}

const ROOT_FOLDERS = [INBOUND_ROOT, OUTBOUND_ROOT] as const;

export type FolderSource =
  | string
  | { objectKey: string; lastModified?: string }
  | { key: string; lastModified?: string };

function normalizeFolder(folder: string): string {
  return folder.trim().replace(/\/+$/, '');
}

function isRootFolder(folder: string): boolean {
  return folder === INBOUND_ROOT || folder === OUTBOUND_ROOT;
}

function utcDateMs(year: number, month: number, day: number): number | null {
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

function dateSegments(folder: string): string[] {
  const parts = normalizeFolder(folder).split('/').filter(Boolean);
  if (parts[0] === INBOUND_ROOT || parts[0] === OUTBOUND_ROOT) {
    return parts.slice(1);
  }
  return parts;
}

/**
 * Date folders are `IN/{yyyy}/{MM}/{dd}` (for example `IN/2026/09/07`).
 * Legacy `IN/ddmmyyyy` and `IN/{MM}/{dd}` keys are still recognized when listing older objects.
 */
export function parseFolderDateMs(folder: string): number | null {
  const segs = dateSegments(folder);
  const yearPart = segs.length >= 1 ? /^(\d{4})$/.exec(segs[0]) : null;
  if (yearPart) {
    const year = Number(yearPart[1]);
    const monthPart = segs.length >= 2 ? /^(\d{2})$/.exec(segs[1]) : null;
    const dayPart = segs.length >= 3 ? /^(\d{2})$/.exec(segs[2]) : null;
    const month = monthPart ? Number(monthPart[1]) : 1;
    const day = dayPart ? Number(dayPart[1]) : 1;
    return utcDateMs(year, month, day);
  }
  const monthOnly = segs.length >= 1 ? /^(\d{2})$/.exec(segs[0]) : null;
  const dayPart = segs.length >= 2 ? /^(\d{2})$/.exec(segs[1]) : null;
  if (monthOnly) {
    const month = Number(monthOnly[1]);
    const day = dayPart ? Number(dayPart[1]) : 1;
    return utcDateMs(2000, month, day);
  }
  const last = segs[segs.length - 1] || '';
  const legacy = /^(\d{2})(\d{2})(\d{4})$/.exec(last);
  if (!legacy) return null;
  return utcDateMs(Number(legacy[3]), Number(legacy[2]), Number(legacy[1]));
}

function folderActivityMs(folder: string, latestTimes?: Map<string, number>): number {
  const fromListing = latestTimes?.get(folder) || 0;
  const fromName = parseFolderDateMs(folder) || 0;
  return Math.max(fromListing, fromName);
}

export function sortParentFolders(
  folders: Iterable<string>,
  latestTimes?: Map<string, number>
): string[] {
  const set = new Set([...folders].map(normalizeFolder).filter(Boolean));
  for (const root of ROOT_FOLDERS) {
    set.add(root);
  }
  const roots = ROOT_FOLDERS.filter((root) => set.has(root));
  const rest = [...set].filter((folder) => !isRootFolder(folder));
  rest.sort((a, b) => {
    const timeDelta = folderActivityMs(b, latestTimes) - folderActivityMs(a, latestTimes);
    if (timeDelta !== 0) return timeDelta;
    return a.localeCompare(b);
  });
  return [...roots, ...rest];
}

function sourceObjectKey(entry: FolderSource): string {
  if (typeof entry === 'string') return entry;
  return 'objectKey' in entry ? entry.objectKey : entry.key;
}

function sourceLastModifiedMs(entry: FolderSource): number {
  if (typeof entry === 'string' || !entry.lastModified) return 0;
  const ms = Date.parse(entry.lastModified);
  return Number.isNaN(ms) ? 0 : ms;
}

export function collectParentFolders(entries: Iterable<FolderSource>): string[] {
  const latestTimes = new Map<string, number>();
  for (const entry of entries) {
    const activity = sourceLastModifiedMs(entry);
    for (const folder of parentFoldersForKey(sourceObjectKey(entry))) {
      latestTimes.set(folder, Math.max(latestTimes.get(folder) || 0, activity));
    }
  }
  return sortParentFolders(latestTimes.keys(), latestTimes);
}

export function folderListPrefix(folder: string): string | undefined {
  const trimmed = folder.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;
  return `${trimmed}/`;
}

/** New copies always land under today's IN folder, not the source object's folder. */
export function objectKeyForNewCopy(_sourceObjectKey: string, newFileName: string): string {
  return inboundObjectKey(newFileName);
}

export function fileNameFromObjectKey(objectKey: string): string {
  const parts = objectKey.trim().replace(/\/+$/, '').split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/** `report.xml` → `report-2.xml`, then `report-3.xml`, … */
export function uniqueXmlFileName(desiredName: string, usedNames: Iterable<string>): string {
  const name = normalizeXmlFileName(desiredName) || 'document.xml';
  const used = new Set([...usedNames].map((n) => n.toLowerCase()).filter(Boolean));
  if (!used.has(name.toLowerCase())) return name;
  const stem = name.replace(/\.xml$/i, '') || 'document';
  let i = 2;
  let candidate = `${stem}-${i}.xml`;
  while (used.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${stem}-${i}.xml`;
  }
  return candidate;
}

export function uniqueObjectKey(desiredKey: string, usedKeys: Iterable<string>): string {
  const used = new Set([...usedKeys].map((key) => key.toLowerCase()).filter(Boolean));
  if (!used.has(desiredKey.toLowerCase())) return desiredKey;
  const slash = desiredKey.lastIndexOf('/');
  const dir = slash >= 0 ? desiredKey.slice(0, slash + 1) : '';
  const file = slash >= 0 ? desiredKey.slice(slash + 1) : desiredKey;
  const uniqueFile = uniqueXmlFileName(
    file,
    [...used].filter((key) => key.startsWith(dir.toLowerCase())).map((key) => fileNameFromObjectKey(key))
  );
  return `${dir}${uniqueFile}`;
}

export function replaceObjectKeyFileName(objectKey: string, _oldFileName: string, newFileName: string): string {
  const name = normalizeXmlFileName(newFileName);
  if (!name) return objectKey;
  if (!isInboundObjectKey(objectKey)) {
    return inboundObjectKey(name);
  }
  const parts = objectKey.trim().replace(/\/+$/, '').split('/');
  parts[parts.length - 1] = name;
  return parts.join('/');
}
