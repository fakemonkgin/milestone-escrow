FROM node:22-alpine

RUN npm install --global pnpm@12.11.2

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @escrow/indexer exec tsc

CMD ["node", "services/indexer/dist/index.js"]