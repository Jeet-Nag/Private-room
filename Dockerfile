# Multi-stage production Dockerfile for PHANTOM ROOM
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: Non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/server ./server
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/tsconfig*.json ./

EXPOSE 3000

CMD ["npm", "start"]
