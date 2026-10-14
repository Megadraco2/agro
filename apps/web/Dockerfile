FROM node:22.16.0-bookworm-slim AS build
RUN npm install -g pnpm@10.34.5
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm exec turbo run build --filter=@agro/web
RUN pnpm --filter @agro/web deploy --legacy --prod /app/deploy

FROM node:22.16.0-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/*
# npm/corepack/yarn vêm embutidos na imagem base mas nunca são usados em
# runtime (CMD roda `next start` direto); removê-los elimina CVEs das
# dependências internas desses gerenciadores sem nenhum custo.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=build --chown=node:node /app/deploy .
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
