# ==========================================
# Stage 1: Build & Dependency Resolver
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ==========================================
# Stage 2: Hardened Minimal Runtime Image
# ==========================================
FROM python:3.11-slim AS runtime

# 1. Apply OS security patches (fixes zlib1g) and purge default packaging tools (eliminates pip/setuptools/wheel/jaraco CVEs)
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* && \
    python -m pip uninstall -y pip setuptools wheel 2>/dev/null || true && \
    rm -rf /usr/local/lib/python3.11/ensurepip /usr/local/bin/pip*

# 2. Copy pre-built application dependencies from builder
COPY --from=builder /install /usr/local

# 3. Create non-root user (appuser:1000)
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser

WORKDIR /app

# 4. Copy application source code with non-root ownership
COPY --chown=appuser:appuser . .

# 5. Ensure data directory exists with appuser ownership
RUN mkdir -p /app/data && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

ENV DATABASE_URL=sqlite:///./data/options.db \
    ROOT_PATH="" \
    PYTHONUNBUFFERED=1

CMD ["python", "-m", "backend.main"]
