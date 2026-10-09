# OutfallWatch — single-image deploy: build the frontend, serve it from FastAPI.
# One container, one public URL (API + SSE + dashboard).

# ---- stage 1: build the React frontend ----
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # -> /web/dist

# ---- stage 2: python runtime serving API + the built frontend ----
FROM python:3.12-slim
WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1 \
    FRONTEND_DIST=/app/frontend/dist

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist

# Hosts inject $PORT (Render/Fly/Cloud Run); default 8000 locally.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
