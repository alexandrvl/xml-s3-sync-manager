const PREFIX = 'xssm_v1_';

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function removeStorage(key: string): void {
  localStorage.removeItem(PREFIX + key);
}
