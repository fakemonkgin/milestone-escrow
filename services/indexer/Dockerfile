FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @escrow/indexer exec tsc

CMD ["node", "services/indexer/dist/index.js"]