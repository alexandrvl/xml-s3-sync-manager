# XML S3 Sync Manager

Browser XML editor with a FastAPI backend. The UI talks to the REST API defined in [`openapi.yaml`](openapi.yaml). Persistence, authentication, and object storage stay on the server; AWS/S3 credentials never appear in the browser.

In production the Python process serves both `/api/v1/...` and the built single-page app on the **same origin**. Local development can still run Vite and uvicorn as two processes.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FastAPI (uvicorn :8080)                                │
│  /api/v1/*  /health  /docs                              │
│  GET /*  →  Vite dist (index.html + /assets)            │
└──────────────────────────┬──────────────────────────────┘
                           │ boto3 (path-style S3)
                           ▼
              SeaweedFS S3 gateway (:8333)
```

- **Frontend** (`frontend/`): React 19, Vite 6, MUI, Tailwind. `base` is `/` so assets load from the same origin.
- **Backend** (`backend/`): FastAPI on Python 3.12. Serves JSON API plus the SPA when `index.html` is present.
- **Object store** (Compose): SeaweedFS master, volume, filer, and S3 gateway. Compatible with the S3 API.

Production requests use relative `/api/v1`, so the browser does not need a second origin or an nginx UI container.

## Directory layout

```
.
├── backend/                 # Python API
│   ├── app/                 # FastAPI application (routers, S3, auth, SPA helper)
│   ├── tests/
│   ├── requirements.txt
│   └── config.example.yaml
├── frontend/                # Vite + React UI
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docker/seaweedfs/        # S3 gateway identity config
├── docker-compose.yml       # SeaweedFS + single app image
├── Dockerfile               # Multi-stage: Node build → Python runtime
├── openapi.yaml
└── .env.example
```

## Prerequisites

- Node.js 20 or later (frontend)
- Python 3.12+ (backend)
- Docker and Docker Compose (production-style run, including SeaweedFS)

This repo’s frontend `package.json` scripts invoke CLIs via `node ./node_modules/...` (not bare bin names) so installs work with `bin-links=false`.

## Local development

Copy env defaults, then run API and UI separately.

```bash
cp .env.example .env
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

- Health: `http://localhost:8080/health`
- OpenAPI UI: `http://localhost:8080/docs`
- REST prefix: `http://localhost:8080/api/v1`

If `frontend/dist` or `backend/static` contains a Vite build, uvicorn also serves the SPA on port 8080. Without those files, only the API is available.

Tests:

```bash
cd backend
pytest
```

### TEST profile (local e2e)

`backend/config.test.yaml` is a dedicated TEST profile. Entra ID is off. The API accepts a static bearer token so Playwright (or curl) can run against a real backend without Microsoft login.

```bash
cd backend
source .venv/bin/activate
APP_PROFILE=test uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

From the frontend, set `VITE_API_BASE_URL=/api/v1` and start Vite. `GET /api/v1/auth/config` reports `profile: test`, `testToken`, and `testEmail`. On load the UI stores that token and calls `/auth/me`.

**UI login (test user)**

| Field | Value |
| --- | --- |
| Email | `test@local` |
| Password | `test-token` |
| Role | Administrator (`Test User`) |

Open the app (Vite: `http://localhost:3000`, Compose: `http://localhost:8080`) and use **Sign in**:

- Click **Sign in as Test User (test@local)**, or
- Enter `test@local` / `test-token` and click **Sign In**

If the header already shows Test User, the session was applied automatically. Sign out first if you want to exercise the form. Override the password/token with `AUTH_TEST_TOKEN` (keep the UI and API in sync).

```bash
curl -s http://localhost:8080/api/v1/auth/config
curl -s http://localhost:8080/api/v1/auth/me \
  -H 'Authorization: Bearer test-token'
```

Do not enable `APP_PROFILE=test` in production.

Docker (rebuild so the UI includes the test-user Sign in button):

```bash
APP_PROFILE=test docker compose up --build
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example ../.env.local   # optional; Vite reads VITE_* from env
npm run dev
```

Open `http://localhost:3000`.

| `VITE_API_BASE_URL` | Behavior |
| --- | --- |
| empty (default) | In-browser adapter that mirrors `openapi.yaml` (no server required) |
| `/api/v1` | Real API; Vite proxies `/api` to `API_PROXY_TARGET` (default `http://127.0.0.1:8080`) |
| full origin | Direct calls to that origin (CORS must allow the Vite origin) |

Other useful scripts: `npm run build`, `npm run preview` (port 4173), `npm run lint` (`tsc --noEmit`).

CORS defaults allow `http://localhost:3000` and `http://localhost:8080`.

## Production Docker

One application image: Node compiles the UI, Python serves it.

### How the multi-stage build works

1. **`frontend` stage** (`node:20-alpine`): `npm ci` in `frontend/`, then `npm run build`. Build-args `VITE_*` are baked into the bundle. The API base defaults to `/api/v1` (same origin).
2. **`runtime` stage** (`python:3.12-slim`): install `backend/requirements.txt`, copy `backend/app`, copy `dist/` from stage 1 to `/app/static`, set `STATIC_DIR=/app/static`, run uvicorn on port 8080.

Compose no longer runs a separate nginx/UI container. SeaweedFS remains as supporting services.

```bash
docker compose build
docker compose up
```

Then:

- App (UI + API): `http://localhost:8080`
- SeaweedFS S3: `http://localhost:8333`
- SeaweedFS master: `http://localhost:9333`
- SeaweedFS filer: `http://localhost:8888`

To rebuild the UI with a different baked API prefix:

```bash
DOCKER_VITE_API_BASE_URL=/api/v1 docker compose build backend
```

Do not leave `VITE_API_BASE_URL` empty in the **image** build if you want the remote API; that flag only applies to the Vite compile. Compose uses `DOCKER_VITE_API_BASE_URL` (default `/api/v1`) so a local empty `VITE_API_BASE_URL` in `.env` does not produce a production bundle that uses the in-browser adapter.

## Static UI serving (Python)

`backend/app/spa.py` attaches routes **after** API routers:

- Existing files under the static directory are returned as-is (`/assets/*` get long-lived `Cache-Control` because Vite hashes those filenames).
- `index.html` and extension-less paths fall back to `index.html` (`Cache-Control: no-cache`) so client-side routes work.
- Paths under `/api`, `/health`, `/docs`, `/redoc`, and `/openapi.json` are never replaced by the SPA.

Lookup order for the static directory: `STATIC_DIR` env / settings, `/app/static`, `backend/static`, `frontend/dist`.

## Environment variables

See [`.env.example`](.env.example). Compose loads `.env` when present.

| Variable | Role |
| --- | --- |
| `VITE_API_BASE_URL` | Frontend **dev** API base; empty = local adapter |
| `DOCKER_VITE_API_BASE_URL` | Baked into the Docker UI build (default `/api/v1`) |
| `VITE_OBJECT_KEY` | Optional default object key in the sync form |
| `VITE_ENTRA_*` | Optional build-time Entra values; runtime `GET /api/v1/auth/config` is preferred |
| `API_PROXY_TARGET` | Vite dev proxy target for `/api` |
| `CORS_ORIGINS` | Comma-separated browser origins for the API |
| `STATIC_DIR` | Directory containing `index.html` |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ADDRESSING_STYLE` | Object storage |
| `S3_CA_BUNDLE` | PEM CA (or chain) for verifying HTTPS S3; empty = default CAs / HTTP unchanged |
| `S3_CLIENT_CERT`, `S3_CLIENT_KEY` | Optional mTLS client certificate and key |
| `DATA_DIR` | Backend data directory |
| `APP_CONFIG_FILE` | YAML config (Compose mounts `backend/config.example.yaml`) |
| `APP_PROFILE` | `test` loads `backend/config.test.yaml` and enables the static test token |
| `AUTH_TEST_TOKEN` | Bearer token accepted only when `APP_PROFILE=test` (default `test-token`) |
| `AUTH_DEV_SECRET` | Dev JWT secret when Entra is off |
| `ENTRA_*` | Microsoft Entra ID (see [Microsoft Entra ID](#microsoft-entra-id)) |

If you change SeaweedFS access keys, update `docker/seaweedfs/s3.json` as well.

## Enterprise PKI / S3 TLS

Production S3 is typically HTTPS and signed by an **internal PKI**, not a public CA. Point the backend at that CA (and at a client certificate if the gateway requires mTLS). Until those paths are set, TLS behaviour stays the boto3 default: HTTP local SeaweedFS is unchanged; HTTPS uses the container/OS CA store.

YAML (`s3` in [`backend/config.example.yaml`](backend/config.example.yaml) or `config.yaml`):

```yaml
s3:
  endpoint: https://s3.example.internal
  ca_bundle: /certs/enterprise-ca.pem
  client_cert: ""          # optional mTLS
  client_key: ""
```

Environment (overrides YAML):

```bash
S3_ENDPOINT=https://s3.example.internal
S3_CA_BUNDLE=/certs/enterprise-ca.pem
# Only if the S3 endpoint requires a client certificate:
# S3_CLIENT_CERT=/certs/s3-client.pem
# S3_CLIENT_KEY=/certs/s3-client.key
```

`S3_CA_BUNDLE` must be a readable PEM file (issuing CA or full chain). The TEST profile (`backend/config.test.yaml`) leaves these empty on purpose.

Docker Compose: mount the files into the backend container and set the **in-container** paths. Example `docker-compose.override.yml`:

```yaml
services:
  backend:
    environment:
      S3_ENDPOINT: https://s3.example.internal
      S3_CA_BUNDLE: /certs/enterprise-ca.pem
    volumes:
      - /etc/pki/ca-trust/source/anchors/enterprise-ca.pem:/certs/enterprise-ca.pem:ro
```

If a configured path is missing at startup, the S3 client fails with `FileNotFoundError` instead of silently skipping verification.

## Microsoft Entra ID

When Entra is on, email/password login is disabled. The React UI uses MSAL.js (`loginRedirect` + PKCE) as a **public client**. The API validates the access token (JWKS) and maps Entra **app roles** to `Administrator`, `Content Editor`, or `Viewer`. Config for the browser comes from `GET /api/v1/auth/config` (preferred). `VITE_ENTRA_*` is only a build-time fallback.

Do not set `APP_PROFILE=test` together with Entra; the TEST profile turns Entra off.

### 1. Register the app

In the [Microsoft Entra admin center](https://entra.microsoft.com): **Identity** → **Applications** → **App registrations** → **New registration**.

- Name: any display name (for example `xml-s3-sync-manager`).
- Supported account types: typically **Accounts in this organizational directory only**.
- Redirect URI: platform **Single-page application (SPA)**, URI matching the UI origin (see table below). MSAL.js v2 requires the **SPA** platform (authorization code + PKCE), not **Web**.

After create, copy **Application (client) ID** and **Directory (tenant) ID**.

### 2. Redirect and logout URIs

**Authentication** → add SPA redirect URIs for every origin you use. Use the origin only (no path), matching `ENTRA_REDIRECT_URI`.

| How you run the UI | Redirect URI |
| --- | --- |
| Vite (`npm run dev`) | `http://localhost:3000` |
| Combined Docker / uvicorn SPA | `http://localhost:8080` |
| Production | HTTPS origin of the app, for example `https://xml-sync.example.com` |

Set the same values for **Front-channel logout** / `ENTRA_POST_LOGOUT_REDIRECT_URI` if you use logout redirect. Implicit grant is not required.

### 3. Expose an API (access token audience)

The UI requests a **custom API scope** so the access token `aud` is this app, not Microsoft Graph.

1. **Expose an API** → set Application ID URI (default `api://<client-id>`).
2. **Add a scope**, for example `access_as_user` (Admin + users can consent).
3. Full scope string: `api://<client-id>/access_as_user`.
4. **Add a client application** (pre-authorize) using the same client ID, and allow that scope, so users are not blocked on consent.

If you use a second API registration, put that app’s Application ID URI in `ENTRA_API_AUDIENCE` and request `api://<api-client-id>/access_as_user`.

### 4. App roles

**App roles** → create roles whose **Value** matches the backend mapping (comma-separated lists in env/YAML):

| App role value (Entra) | App role in this product |
| --- | --- |
| `Administrator` or `Admin` | Administrator |
| `Content Editor` or `Editor` | Content Editor |
| anything else, or no `roles` claim | Viewer |

Allowed member types: **Users/Groups**. Then **Enterprise applications** → this app → **Users and groups** → assign each user a role. Assigned roles appear in the access token `roles` claim.

### 5. API permissions (optional)

**API permissions** → add **My APIs** → this app → `access_as_user`. OpenID scopes (`openid`, `profile`, `email`) are requested by MSAL automatically when you include them in `ENTRA_SCOPES`.

A **client secret** is only required for `POST /api/v1/auth/entra/token` (confidential-client code exchange). The browser sign-in path does not use the secret; do not put it in Vite/`VITE_*` variables.

### 6. Configure this repo

Copy [`.env.example`](.env.example) to `.env` (and/or edit `backend/config.example.yaml`; env vars override YAML).

```bash
ENTRA_AUTH_ENABLED=true
ENTRA_TENANT_ID=<directory-tenant-id>
ENTRA_CLIENT_ID=<application-client-id>
ENTRA_AUTHORITY=https://login.microsoftonline.com/<directory-tenant-id>
ENTRA_REDIRECT_URI=http://localhost:3000
ENTRA_POST_LOGOUT_REDIRECT_URI=http://localhost:3000
ENTRA_SCOPES=api://<application-client-id>/access_as_user openid profile email
ENTRA_API_AUDIENCE=api://<application-client-id>
# Optional overrides; defaults are derived from tenant/client id:
# ENTRA_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
# ENTRA_JWKS_URL=https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys
ENTRA_ADMIN_ROLES=Administrator,Admin
ENTRA_EDITOR_ROLES=Content Editor,Editor
ENTRA_VIEWER_ROLES=Viewer
```

For Docker Compose, use `http://localhost:8080` for redirect URIs. Rebuild the UI if you rely on baked `VITE_ENTRA_*` (runtime `/auth/config` is enough when the API is on the same origin).

YAML equivalent under `entra:` in [`backend/config.example.yaml`](backend/config.example.yaml): `enabled`, `tenant_id`, `client_id`, `authority`, `redirect_uri`, `scopes`, `api_audience`, `admin_roles`, `editor_roles`, `viewer_roles`.

### 7. Check it

1. Start the API with Entra enabled and `VITE_API_BASE_URL=/api/v1` (or Compose on `:8080`).
2. `curl -s http://localhost:8080/api/v1/auth/config` should show `"enabled": true` and your `clientId` / `scopes`.
3. Open the UI, **Sign in with Microsoft**, complete the redirect, then `GET /api/v1/auth/me` with `Authorization: Bearer <access-token>` should return the mapped role.

If tokens fail validation, confirm the SPA requests the **API** scope (not only `User.Read`), `ENTRA_API_AUDIENCE` matches token `aud`, and the user is assigned an app role.

## Usage

1. Sign in (`POST /api/v1/auth/login` when the remote API is enabled).
2. Upload XML (`POST /api/v1/documents`).
3. Edit in the table or raw source.
4. Sync with an object key only (`PUT /api/v1/objects`).
