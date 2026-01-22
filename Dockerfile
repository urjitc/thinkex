# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat git
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Development image - run Next.js in dev mode
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files and drizzle config (source code will be mounted as volume)
COPY package.json pnpm-lock.yaml* ./
COPY drizzle.config.ts ./

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run Next.js in development mode
# Default to pnpm since that's what the project uses
RUN corepack enable pnpm
CMD ["pnpm", "dev"]
