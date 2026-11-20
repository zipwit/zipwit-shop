FROM node:26.13.1-alpine AS base
RUN npm install -g pnpm@12.21.0
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM build AS migrate
ENV NODE_ENV=production
USER node
CMD ["pnpm", "db:migrate"]

FROM node:26.13.1-alpine AS app
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

FROM node:26.13.1-bookworm-slim AS deal-scout
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python
RUN npm install -g pnpm@12.21.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY deal-scout /app/deal-scout
RUN uv sync --project deal-scout --locked --no-dev && chmod -R a+rX /opt/uv-python
COPY tsconfig.json ./
COPY src ./src
COPY scripts/catalog-import.ts ./scripts/catalog-import.ts
USER node
WORKDIR /app/deal-scout
ENTRYPOINT ["/app/deal-scout/.venv/bin/zipwit-deals"]

FROM nginx:1.31.8-alpine AS web
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/.output/public /usr/share/nginx/html
