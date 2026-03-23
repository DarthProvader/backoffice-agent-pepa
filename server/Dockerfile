FROM node:22-slim

# Install system deps: Python, sqlite3, bun
RUN apt-get update && apt-get install -y \
    python3 python3-venv python3-pip \
    sqlite3 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install Claude Code CLI (needed by Agent SDK)
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy server package files and install deps
COPY server/package.json server/bun.lock ./server/
RUN cd server && bun install --frozen-lockfile

# Build server
COPY server/ ./server/
RUN cd server && bun run build

# Setup Python venv with document + Google deps
RUN python3 -m venv .venv
COPY scripts/ ./scripts/
RUN .venv/bin/pip install --no-cache-dir \
    openpyxl pandas python-pptx reportlab pypdf pdfplumber \
    python-docx markitdown Pillow matplotlib \
    google-api-python-client google-auth-oauthlib

# Copy skills and config
COPY .claude/ ./.claude/
COPY CLAUDE.md ./

# Create data directories
RUN mkdir -p data/outputs data/scheduled-tasks data/task-results data/listings

# Seed database
COPY server/scripts/ ./server/scripts/
RUN cd server && node dist/scripts/seed-database.js 2>/dev/null || true

EXPOSE 3001

# Start server from server/ directory (so node_modules resolve works)
WORKDIR /app/server
CMD ["node", "dist/index.js"]
