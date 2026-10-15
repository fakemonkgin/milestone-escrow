FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

CMD ["pnpm", "--filter", "@escrow/web", "dev", "--hostname", "0.0.0.0"]