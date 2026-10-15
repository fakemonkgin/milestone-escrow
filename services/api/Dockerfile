FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @escrow/domain exec tsc

RUN pnpm --filter @escrow/api exec tsc

CMD ["node", "services/api/dist/server.js"]