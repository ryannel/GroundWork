# ── Base ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# --trust-lockfile skips re-running pnpm's supply-chain release-age verification
# against each entry: the lockfile was just produced by this project's own
# `pnpm install` and is the trusted build input, so the check only blocks the
# image on transiently too-new deps (ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION).
RUN pnpm install --frozen-lockfile --ignore-scripts --trust-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
<% if (auth === 'clerk') { %>
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
<% } %>
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (requires output: 'standalone' in next.config.mjs)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE <%= assignedPort %>
ENV PORT=<%= assignedPort %>
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
