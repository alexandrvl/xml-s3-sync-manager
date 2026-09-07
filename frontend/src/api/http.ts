import { ApiError } from './errors';
import { acquireEntraToken, isEntraConfigured } from '../auth/entra';
import { getAccessToken, getApiBaseUrl } from './config';

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const base = getApiBaseUrl();
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    let token = getAccessToken();
    if (isEntraConfigured()) {
      try {
        token = (await acquireEntraToken()) || token;
      } catch {
        /* use cached token */
      }
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = parseBody(text);

  if (!response.ok) {
    const err = data as { code?: string; message?: string } | undefined;
    throw new ApiError(
      response.status,
      err?.code || 'request_failed',
      err?.message || `Request failed with status ${response.status}`
    );
  }

  if (data === undefined && text) {
    throw new ApiError(response.status, 'request_failed', 'Response was not valid JSON.');
  }

  return data as T;
}
