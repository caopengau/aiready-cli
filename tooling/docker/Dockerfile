# AIReady CLI Docker Image
# Multi-stage build for optimized image size

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core ./packages/core
COPY packages/cli ./packages/cli
COPY packages/pattern-detect ./packages/pattern-detect
COPY packages/context-analyzer ./packages/context-analyzer
COPY packages/consistency ./packages/consistency
COPY packages/visualizer ./packages/visualizer
COPY tsconfig.base.json ./

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aiready/cli build

# Runtime stage
FROM node:24-alpine

LABEL maintainer="AIReady <hello@getaiready.dev>"
LABEL org.opencontainers.image.title="AIReady CLI"
LABEL org.opencontainers.image.description="AI readiness analysis tools - detect issues that confuse AI models"
LABEL org.opencontainers.image.url="https://getaiready.dev"
LABEL org.opencontainers.image.source="https://github.com/getaiready/aiready-cli"
LABEL org.opencontainers.image.vendor="AIReady"

WORKDIR /app

# Copy built packages from builder
COPY --from=builder /app/packages/cli/dist ./dist
COPY --from=builder /app/packages/cli/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S aiready && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G aiready -g aiready aiready && \
    chown -R aiready:aiready /app

USER aiready

# Set up entry point
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node dist/cli.js --version || exit 1