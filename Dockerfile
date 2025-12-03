# Stage 1: Builder
FROM node:18-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:18-slim

WORKDIR /app

# Install runtime dependencies and whisper.cpp requirements
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    cmake \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r gnani && useradd -r -g gnani -d /home/gnani -m gnani

# Set up whisper.cpp directory
RUN mkdir -p /home/gnani/.gnani/whisper-cpp && \
    chown -R gnani:gnani /home/gnani/.gnani

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/scripts ./scripts

# Install production dependencies only
RUN npm ci --only=production

# Install whisper.cpp (as gnani user)
USER gnani
WORKDIR /home/gnani/.gnani
RUN git clone https://github.com/ggerganov/whisper.cpp.git
WORKDIR /home/gnani/.gnani/whisper.cpp
RUN make

# Download model
RUN bash ./models/download-ggml-model.sh base.en

# Switch back to app directory
WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV USE_WHISPER_CPP=true

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
