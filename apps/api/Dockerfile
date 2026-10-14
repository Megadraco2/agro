FROM node:22.16.0-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.34.5
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@agro/api
RUN pnpm --filter @agro/api deploy --legacy --prod /app/deploy

FROM node:22.16.0-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# npm/corepack/yarn vêm embutidos na imagem base mas nunca são usados em
# runtime (CMD roda `node` direto); removê-los elimina CVEs das dependências
# internas desses gerenciadores sem nenhum custo, já que nada aqui os invoca.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=build --chown=node:node /app/deploy .
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
