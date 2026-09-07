import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';
import { getAccessToken, setAccessToken } from '../api/config';

export interface EntraPublicConfig {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  authority: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  scopes: string[];
  apiAudience?: string;
  profile?: string;
  testAuthEnabled?: boolean;
  testToken?: string | null;
  testEmail?: string | null;
  testName?: string | null;
}

let pca: PublicClientApplication | null = null;
let tokenScopes: string[] = [];
let initialized = false;

function envFallbackConfig(): EntraPublicConfig | null {
  const enabled = (import.meta.env.VITE_ENTRA_ENABLED || '').toLowerCase() === 'true';
  const clientId = (import.meta.env.VITE_ENTRA_CLIENT_ID || '').trim();
  const tenantId = (import.meta.env.VITE_ENTRA_TENANT_ID || '').trim();
  if (!enabled || !clientId) {
    return null;
  }
  const authority =
    (import.meta.env.VITE_ENTRA_AUTHORITY || '').trim() ||
    `https://login.microsoftonline.com/${tenantId || 'common'}`;
  const scopes = (import.meta.env.VITE_ENTRA_SCOPES || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    enabled: true,
    tenantId,
    clientId,
    authority,
    redirectUri: (import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin).trim(),
    scopes,
  };
}

export function isEntraConfigured(): boolean {
  return pca !== null;
}

export async function initEntra(config: EntraPublicConfig | null): Promise<string | null> {
  const resolved = config?.enabled && config.clientId ? config : envFallbackConfig();
  if (!resolved) {
    return getAccessToken();
  }
  tokenScopes =
    resolved.scopes.length > 0
      ? resolved.scopes
      : resolved.apiAudience
        ? [`${resolved.apiAudience}/.default`]
        : [`api://${resolved.clientId}/access_as_user`];

  const configuration: Configuration = {
    auth: {
      clientId: resolved.clientId,
      authority: resolved.authority,
      redirectUri: resolved.redirectUri || window.location.origin,
      postLogoutRedirectUri: resolved.postLogoutRedirectUri || resolved.redirectUri || window.location.origin,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  };
  pca = new PublicClientApplication(configuration);
  await pca.initialize();
  initialized = true;
  const redirect = await pca.handleRedirectPromise();
  if (redirect?.account) {
    pca.setActiveAccount(redirect.account);
  } else {
    const existing = pca.getAllAccounts()[0];
    if (existing) {
      pca.setActiveAccount(existing);
    }
  }
  if (redirect?.accessToken) {
    setAccessToken(redirect.accessToken);
    return redirect.accessToken;
  }
  return acquireEntraToken();
}

export async function loginWithEntra(): Promise<void> {
  if (!pca || !initialized) {
    throw new Error('Microsoft Entra ID is not configured.');
  }
  await pca.loginRedirect({
    scopes: tokenScopes,
    prompt: 'select_account',
  });
}

export async function acquireEntraToken(): Promise<string | null> {
  if (!pca || !initialized) {
    return getAccessToken();
  }
  const account: AccountInfo | null = pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
  if (!account) {
    return getAccessToken();
  }
  pca.setActiveAccount(account);
  try {
    const result = await pca.acquireTokenSilent({ scopes: tokenScopes, account });
    setAccessToken(result.accessToken);
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await pca.acquireTokenRedirect({ scopes: tokenScopes, account });
      return null;
    }
    throw error;
  }
}

export async function logoutEntra(): Promise<void> {
  if (!pca || !initialized) {
    return;
  }
  const account = pca.getActiveAccount() || pca.getAllAccounts()[0];
  await pca.logoutRedirect({ account: account || undefined });
}
