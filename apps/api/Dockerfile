FROM node:22.16.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.34.5
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@agro/api
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "@agro/api", "start"]
