FROM node:22-alpine

RUN npm install --global pnpm@12.11.2

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

CMD ["pnpm", "--filter", "@escrow/web", "dev", "--hostname", "0.0.0.0"]