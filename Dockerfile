# ============================================
# Stage 1: Install dependencies
# ============================================

ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

# bun.lock, not package-lock.json. `.gitignore` excludes package-lock.json, so
# it does not exist in a fresh clone — an `npm ci` here builds on a developer's
# machine and fails on the deployment server, which is the worst possible place
# to find out. bun.lock is the lockfile this repo actually tracks.
RUN npm install -g bun

# No `bun.lock*` glob: a missing lockfile must fail the build, not silently
# resolve fresh versions and produce an image nobody can reproduce.
COPY package.json bun.lock ./

# Install dependencies with frozen lockfile for reproducible builds.
#
# If this fails with "lockfile had changes, but lockfile is frozen", bun.lock
# has drifted from package.json. Regenerate it — do not relax the flag:
#   docker run --rm -v "$PWD:/host" oven/bun:1 sh -c \
#     'mkdir /b && cd /b && cp /host/package.json . && bun install && cp bun.lock /host/'
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --no-save --frozen-lockfile

# ============================================
# Stage 2: Build the Next.js application
# ============================================

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars — override these with --build-arg or in compose.yml
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SENTRY_DISABLED=true

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present here. Server secrets (SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)
# must NOT be build args — pass them at run time with -e so they never end up in
# an image layer.
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV BUILD_STANDALONE=true

RUN npm run build

# ============================================
# Stage 3: Production runner
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Chromium for the PDF routes (/api/organizations/report/pdf and the profile
# document). @sparticuz/chromium — the package used on Vercel — ships a binary
# built against a Lambda base image and does not run on Debian slim, so install
# the distro's own Chromium and point the launcher at it. `launchBrowser()` in
# src/lib/pdf/print-to-pdf.ts checks PUPPETEER_EXECUTABLE_PATH first, which is
# exactly this case.
#
# The Arabic font is not optional. Puppeteer renders the letterhead header and
# footer templates in a separate context with no access to the page's
# self-hosted web fonts, so a container with no system Arabic face prints the
# ministry letterhead as empty boxes.
#
# Costs roughly 500MB of image size. Remove this block only if PDF export is
# not used at all.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy public assets
COPY --from=builder --chown=node:node /app/public ./public

# Create .next dir with correct permissions for prerender cache
RUN mkdir .next && chown node:node .next

# Copy standalone output and static files
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "server.js"]
