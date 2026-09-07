/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OBJECT_KEY?: string;
  readonly VITE_ENTRA_ENABLED?: string;
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_AUTHORITY?: string;
  readonly VITE_ENTRA_REDIRECT_URI?: string;
  readonly VITE_ENTRA_SCOPES?: string;
  readonly VITE_TEST_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
