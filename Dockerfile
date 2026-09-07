# syntax=docker/dockerfile:1

# Stage 1: production build of the Vite/React UI
FROM node:20-alpine AS frontend
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci

COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json ./
COPY frontend/src ./src
COPY frontend/public ./public

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_OBJECT_KEY=
ARG VITE_ENTRA_ENABLED=false
ARG VITE_ENTRA_TENANT_ID=
ARG VITE_ENTRA_CLIENT_ID=
ARG VITE_ENTRA_AUTHORITY=
ARG VITE_ENTRA_REDIRECT_URI=
ARG VITE_ENTRA_SCOPES=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_OBJECT_KEY=$VITE_OBJECT_KEY \
    VITE_ENTRA_ENABLED=$VITE_ENTRA_ENABLED \
    VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID \
    VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID \
    VITE_ENTRA_AUTHORITY=$VITE_ENTRA_AUTHORITY \
    VITE_ENTRA_REDIRECT_URI=$VITE_ENTRA_REDIRECT_URI \
    VITE_ENTRA_SCOPES=$VITE_ENTRA_SCOPES

RUN npm run build

# Stage 2: Python API + static UI
FROM python:3.12-slim AS runtime
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/config.example.yaml ./config.example.yaml
COPY backend/config.test.yaml ./config.test.yaml
COPY --from=frontend /frontend/dist ./static

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_HOST=0.0.0.0 \
    APP_PORT=8080 \
    STATIC_DIR=/app/static

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
