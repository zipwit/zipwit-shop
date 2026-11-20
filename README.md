# Zipwit Shop

Zipwit’s clothing and footwear storefront. Production domain: **to be configured**. Repository name: `zipwit-shop`.

A Georgian and English storefront for browsing wholesale clothing and footwear, comparing deals, and saving products to a cart. Includes catalog search and filters, email/password sign-in, email-code verification and password reset, optional social sign-in, and an address book. Georgian is the default language.

**Status:** browsing, accounts, addresses, carts, and bank-transfer checkout are implemented. Checkout supports U.S. delivery, frozen USD/GEL totals, private receipt uploads, and pending orders. Warehouse shipping rates must be configured before new orders can proceed; no default rates are bundled. Payment verification and fulfillment remain manual. See [Checkout](#checkout) and [Known limitations](#known-limitations).

## Contents

- [Quick start](#quick-start)
- [Stack](#stack)
- [Architecture](#architecture)
- [Features](#features)
- [UI and localization](#ui-and-localization)
- [Development](#development)
- [Configuration](#configuration)
- [Commands](#commands)
- [Production](#production)
- [Repository layout](#repository-layout)
- [Testing](#testing)
- [Extending](#extending)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

## Quick start

Requires Docker with the Compose plugin. The dev stack runs the app with PostgreSQL 19, a three-primary Redis Cluster, Nginx, and the checkout notification worker; host Node.js and pnpm are optional.

1. Create `.env.development` in the repo root (see [Configuration](#configuration)). Set `BETTER_AUTH_SECRET` (`openssl rand -hex 32`). Env files are git- and Docker-ignored. See [checkout settings](#checkout) and [warehouse shipping rules](#configure-warehouse-shipping).
2. Start the stack. The included initial migration creates the application tables before the app starts:

   ```sh
   docker compose --env-file .env.development -f docker-compose.dev.yaml up --build
   ```

3. Open **http://localhost:3000**. Migrations run before the app starts; Nginx proxies requests and hot-reload WebSockets to Vite. Dev uses plain HTTP, so no certificates are needed.
4. Optionally seed the catalog:

   ```sh
   docker compose --env-file .env.development -f docker-compose.dev.yaml exec app pnpm db:seed
   ```

   Seeding creates sample products and SKUs, then tries to refresh the search index and stats. Re-running replaces products under the reserved `.example` warehouse domains. It refuses to run with `NODE_ENV=production`.
5. To preview shipment costs, use the [development shipping rules](#development-preview-with-seeded-products). Checkout also requires the payment settings and a valid exchange rate.

Without a Resend key, dev emails and verification codes appear in the app logs:

```sh
docker compose --env-file .env.development -f docker-compose.dev.yaml logs -f app
```

**SELinux hosts (Fedora, RHEL):** bind mounts in the Compose files use `:z` / `selinux: z` so containers can read them. Without it you get `Permission denied` on project files.

## Stack

Exact ranges are in `package.json`; resolved versions in `pnpm-lock.yaml`. Always install with the frozen lockfile.

| Layer              | Technology                                                   |
| ------------------ | ------------------------------------------------------------ |
| Runtime            | Node.js 26, pnpm 12, TypeScript 7                            |
| App                | React 19, TanStack Start/Router/Query/Form/Store, Zod 4      |
| UI                 | Tailwind CSS 4, Base UI, copied shadcn components, Hugeicons |
| Auth               | Better Auth, Better Auth UI                                  |
| Data               | PostgreSQL via node-postgres, Drizzle ORM/Kit 1.0 RC         |
| Live catalog/cache | Redis 8 Cluster with Search and JSON                         |
| Catalog ingestion  | Python 3.15.2, Crawlee, Gemini, PostgreSQL verdict cache     |
| Email              | Resend                                                       |
| Build/hosting      | Vite 8, Nitro 3 beta, Docker Compose, Nginx                  |
| Quality            | Biome, Vitest, Knip, TypeScript diagnostics                  |

Drizzle and Nitro are pinned prereleases: review migration notes and run the full validation pipeline when changing them.

## Architecture

The storefront, Deal Scout, and checkout notification worker run as separate processes.
Redis Cluster handles live catalog reads and writes: product details, prices, stock,
search, facets, stats, and sitemap data. Carts and auth secondary storage also use
the cluster. Reads go to primaries so a write is immediately visible to subsequent
reads. PostgreSQL keeps users, addresses, checkout drafts, payment evidence, orders,
and notification jobs transactional.

The live catalog is owned by Redis. Trusted server code calls
`putCatalogProduct` and `deleteCatalogProduct` in
`src/features/catalog/catalog-store.server.ts`; each product and its Search
summary update atomically on their shard. Timestamp revisions reject older writes.
Catalog reads and writes do not query PostgreSQL, and an empty Redis catalog stays
empty until products are written. There is no upload, review, or approval dashboard.

Operators manage store URLs and offer rules at `/admin`. PostgreSQL stores feed configuration. Deal Scout reads active feeds directly from PostgreSQL by default. It also accepts the protected HTTPS feed endpoint or a local JSON file. Crawlee reads retailer pages. Python checks each variant’s stock, price, discount and size. Gemini then searches for shopper reviews of the exact product. Only negative sentiment excludes an otherwise eligible deal. A product can list even when no reviews are available. In publish mode the worker passes qualifying products and withdrawals to the catalog writer automatically. [Deal Scout architecture and setup](deal-scout/README.md#architecture)

PostgreSQL stores operator feed rules. Redis owns product and SKU records. `pnpm search:sync`
rebuilds derived Search documents from the Redis product records. Redis persistence
and backups protect the live catalog.

```mermaid
flowchart LR
    Browser --> Nginx
    Nginx --> Assets[Static assets]
    Nginx --> App[TanStack Start / Nitro]
    App --> SQL[(PostgreSQL: accounts / orders / payments)]
    App --> Redis[(Redis Cluster: 3 primaries)]
    App --> Email[Resend]
    App --> Rates[NBG USD rate]
    Feeds[Store feeds and rules] --> Catalog[Deal Scout]
    Retailers[Retailer product pages] -->|Crawlee| Catalog
    Catalog <-->|Shopper review search and sentiment| Gemini
    Catalog -->|Catalog snapshots| Writer[Trusted Node writer]
    Writer --> Redis
    Worker[Checkout notification worker] --> SQL
    Worker --> Telegram[Telegram]
    Sync[search:sync] --> Redis
```

In dev, Nginx forwards everything to Vite. In production it serves built assets directly and proxies the rest to Node. The runtime image runs as the non-root `node` user; migrations run in a separate one-shot service.

### Conventions

| Location                          | Responsibility                                                              |
| --------------------------------- | --------------------------------------------------------------------------- |
| `src/routes/`                     | Route params, validated search, loaders, metadata, HTTP endpoints.          |
| `src/features/<feature>/`         | Business logic, components, query options, schemas, mutations.              |
| `*.functions.ts`                  | Browser-callable server functions: validate input, enforce access.          |
| `*.server.ts`                     | Server-only code (DB, Redis, email, secrets). Still validate and authorize. |
| `*.queries.ts` / `*.mutations.ts` | Cache keys, query options, mutation coordination.                           |
| `src/components/`                 | Shared layout, forms, auth views, home sections, UI primitives.             |
| `src/data/`, `src/i18n/`          | Site config, catalog taxonomy, types, messages.                             |

Route loaders run on both server and client, so they are **not** a server-only boundary. Keep private work behind server functions.

Use JSDoc for contracts and invariants that readers need at the declaration. Put setup, workflows, and architecture in the project documentation. Keep implementation code free of explanatory inline comments.

### Request lifecycle

1. `src/router.tsx` creates a router and a per-request QueryClient (no shared module-level client holding user data).
2. The root route resolves locale from a cookie and loads public config.
3. Loaders fill Query's cache via shared query options; SSR hydrates it in the browser.
4. Navigation validates search input, preloads on intent, and restores scroll.
5. Mutations call server functions, then update or invalidate affected queries.

### State ownership

| State                                     | Owner                |
| ----------------------------------------- | -------------------- |
| Catalog search, filters, sort, SKU choice | Validated URL search |
| Products, facets, stats, cart, addresses  | TanStack Query       |
| Form values and validation                | TanStack Form        |
| Debounce text, slider drafts, popovers    | Component state      |
| Cart drawer open/closed                   | TanStack Store       |
| Locale and visitor cart identity          | HTTP-only cookies    |

### Routes

| URL                         | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `/`                         | Hero, deals, departments, and a three-step shopping guide.                        |
| `/deals`                    | Searchable, filterable discounted products.                                       |
| `/stores/$storeId`          | Anonymous store catalog with filters, including full-price products; not indexed. |
| `/about`                    | Deal selection, review policy, and offer expiry.                                  |
| `/$department/{-$category}` | Department listing, optional category (`/women/shoes`).                           |
| `/product/$slug`            | Product details and SKU selection.                                                |
| `/auth/$path`               | Better Auth UI views (sign-in, verification, ...).                                |
| `/settings/$path`           | Account and security settings, saved addresses.                                   |
| `/checkout`                 | Resumable bank-transfer checkout and confirmation, not indexed.                   |
| `/api/auth/*`               | Better Auth handler.                                                              |
| `/api/health`               | Liveness only; does not check PostgreSQL or Redis.                                |
| `/api/ready`                | Production readiness probe for PostgreSQL and Redis connectivity.                 |
| `/sitemap.xml`              | Public pages (including About) and products with available SKUs.                  |

`src/routeTree.gen.ts` is generated by the Vite integration. Don't edit it.

## Features

### Homepage

The homepage introduces the store, shows the biggest discounts and links to departments. The shopping guide explains variant pricing, shipping by store and payment references.

- The hero shows deal and warehouse counts. The deals section owns the last price-check note and the link to all deals; it is hidden when no deals are available.
- Deal cards scroll horizontally, with three cards across at tablet widths and four on desktop. Previous/next controls disappear when the row fits, and scrolling respects reduced-motion preferences.
- Department tiles link to each department and its categories. The shopping guide covers shipping, service fees, and the final total.

### About and footer navigation

The About page pairs fashion photography with keyboard-accessible questions about retailer prices, shopper sentiment and offer expiry.

- The footer links to **About us** under **Discover** (Georgian: **ჩვენ შესახებ** under **გაგვიცანით**).
- Page copy and metadata support English and Georgian; `/about` is included in the sitemap.

### Catalog and search

`src/data/catalog.ts` defines the department/category taxonomy. Products hold identity and descriptions; SKUs hold color, size, image, price, original price, and stock. Money is stored as integer minor units (tetri for GEL, cents for USD) plus a currency code.

Catalog records and in-stock SKU summaries are published as Redis JSON documents. Product details and cart SKU lookups read the complete Redis records; search reads the summaries. Department listings show each product's cheapest SKU; Deals shows the deepest-discounted one. Search supports text, brand, size, color, price range, sale status, and sorting, in pages of up to 48 with automatic and manual load-more.

- The index name includes a hash of its schema and store-identity key fingerprint. First catalog access creates the index and rebuilds derived fields from Redis when the schema changes (memoized per process). This is **not** a scheduled import.
- Catalog writes update Search directly. Run `pnpm search:sync` after changing derived fields; it removes summaries whose Redis product record is gone.
- The server caches aggregate deal and warehouse counts for 30 seconds. The client caches results and facets for one minute and stats for five minutes.
- Search needs Redis Search and JSON and has no PostgreSQL catalog fallback.

### Cart

- The cart belongs to a visitor's `cartId` cookie, not an account, and is not merged on sign-in.
- Redis stores SKU IDs and quantities at `cart:<id>` with a 30-day expiry. Prices and availability are re-read from Redis catalog records on every fetch; unavailable SKUs are omitted.
- Limits: 50 lines, 10 units per SKU, one currency.
- Client writes share a mutation scope (serialized per client) and refresh after the last queued write.
- Redis scripts enforce limits and quantity changes atomically across clients. Adds revalidate catalog currency when SKU membership changes, retrying up to eight times before asking the customer to retry.
- Quantity updates cannot recreate removed lines. Checkout records the originating cart and subtracts purchased quantities atomically. The worker retries failed cleanup without subtracting the same order twice. Catalog reads and Redis writes are separate; checkout validates its own quote.

### Checkout

- Signed-in customers select a U.S. address, review a server-created quote, transfer either the USD or GEL total, and upload a receipt before placing an order.
- For worker-sourced deals, the operator can recheck the exact size SKU and quoted unit price against the retailer before requesting payment. The checkout UI does not run this step. After verifying the transfer, the operator places the retailer order manually. [Pre-payment recheck](deal-scout/README.md#recheck-before-payment)
- Shipping is calculated per warehouse using flat rates and optional free-shipping thresholds stored in PostgreSQL. Cart estimates and new checkout quotes read the current rules. Saved quotes retain their original shipping costs.
- The server freezes prices, fees, and the exchange rate. New payment instructions expire after 24 hours or at the earliest supplier offer expiry, whichever comes first. Retrying a saved quote preserves its amounts and deadline. Customers who already paid can still submit their receipt after expiry.
- Orders and notification jobs commit together. Order item SKU IDs, names, color/size, and prices are frozen in PostgreSQL without foreign keys into the live catalog; deal expiry or deletion cannot remove them. The separate worker forwards order details and receipts to the configured Telegram chat; payment verification remains manual.
- Set the receiving IBAN, service fee, and private Telegram destination in the server environment. Configure shipping for each warehouse. See [Configuration](#configuration) and [warehouse shipping](#configure-warehouse-shipping).

### Anonymous store browsing

Product and deal cards, product details, and cart shipments show the same anonymous **Store XXXXXXXX** code. Product pages and cart shipment summaries link to `/stores/$storeId` through **Shop more from this store**; opening it from the cart closes the drawer. Store pages include full-price and discounted products, and search, facets, sorting, pagination and clearing filters remain within the selected store.

The public ID is the same keyed digest used for shipment grouping. Supplier domains and source product URLs are not returned in product-detail responses; the search index stores only the opaque store ID. Display codes use the first eight uppercase characters, while routes and shipping use the full identifier. These labels identify a shared shipping source, not a supplier name.

Store IDs depend on `BETTER_AUTH_SECRET`. Rotating it changes public store links and codes; existing checkout snapshots retain their recorded IDs and charges. The search-index identity includes a key fingerprint so the index rebuilds after a rotation as well as after schema changes. No database migration is required.

### Configure warehouse shipping

Store each confirmed warehouse rate in PostgreSQL under the exact domain from the product. Amounts are integer USD cents. A null threshold means the flat rate applies at every subtotal. For example, this sets a $6 rate with free shipping from $50 for a fictional warehouse.

```sh
docker compose --env-file .env.development -f docker-compose.dev.yaml exec -T postgres \
  psql -U zipwit -d zipwit -c "INSERT INTO warehouse_shipping_rule (warehouse, flat_rate_usd, free_from_usd) VALUES ('store.example',600,5000) ON CONFLICT (warehouse) DO UPDATE SET flat_rate_usd=excluded.flat_rate_usd, free_from_usd=excluded.free_from_usd"
```

Edits apply on the next cart read or new quote. A missing rate blocks checkout for that warehouse. The development seed installs example rates only for its fictional retailers.

### Authentication and addresses

- Better Auth lives under `/api/auth`, using PostgreSQL (Drizzle relations-v2 adapter) plus Redis secondary storage and rate limiting.
- Email/password accounts require verification; email codes cover verification and password reset. Codes are stored hashed; resets revoke sessions.
- Google and Facebook appear only when both credentials are configured.
- Resend sends email in production; dev without a key logs it instead.
- Address functions resolve the user from request headers and scope every operation to that owner. Each account can save up to 10 addresses. The first saved address becomes primary. Immediate write transactions serialize address changes, and a partial unique index allows one primary. Removing the primary promotes the oldest remaining address.

### Persistence

| Storage                                                                   | Data                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PostgreSQL auth tables                                                    | Users and linked sign-in accounts.                                             |
| PostgreSQL `address`                                                      | Owned addresses, primary selection.                                            |
| PostgreSQL `orders`, `order_item`                                         | Pending orders and immutable purchased-item snapshots.                         |
| PostgreSQL `checkout_session`, `order_notification`, `order_cart_cleanup` | Private quotes, receipts, notification and cart cleanup jobs.                  |
| Redis Cluster                                                             | Live catalog records, SKU/slug lookups, search, carts, auth secondary storage. |

The app, checkout notification worker, and Deal Scout share PostgreSQL. Compose persists the cluster in the `postgres-data` volume. Back up the database with `pg_dump` and verify restoration into a separate database. Deal Scout stores its review cache and the discovery feeds for each published SKU in PostgreSQL.

Each Redis primary has its own volume and uses AOF with an every-second fsync. Back up these volumes separately for catalog, carts, and auth secondary state. The three primaries have no replicas. Losing one makes the cluster unavailable until it returns.

App deployments initialize the Redis Cluster over the internal Compose network and keep existing cluster data. The disposable CI cluster uses Linux host networking so host-run checks can reach the addresses Redis advertises.

## UI and localization

**Design.** The transparent Zipwit logo sits on a light glass header and warm neutral footer. The hero uses upright display type, a restrained violet wash, and responsive editorial photography. Product cards have soft borders, consistent padding, and subtle hover elevation.

**Motion.** Headings, forms, and purchase actions render in place. CSS handles pointer hover feedback, popover transitions, and optional smooth scrolling. Movement follows the operating system’s reduced-motion preference.

**Tokens.** `src/styles.css` owns color, type, radius, and motion tokens: violet surfaces, Zipwit violet `#5b3df5`, lime accent `#c6f432`, Offers yellow `#ffd21f`, warm light content areas, and a separate `link` token for readable links. No theme switch. Fonts (Figtree, Archivo, Noto Sans Georgian) are bundled via Fontsource.

| Utility           | Use                                  |
| ----------------- | ------------------------------------ |
| `type-display`    | Large promotional headlines.         |
| `type-title`      | Page and section headings.           |
| `type-card-title` | Product and card titles.             |
| `type-body`       | Descriptive copy.                    |
| `type-caption`    | Small supporting text.               |
| `type-eyebrow`    | Short category/brand/section labels. |
| `type-num`        | Prices, counts, numbers.             |

**Composition.** Use `Container`, `Section` (`src/components/layout/container.tsx`) and `SectionHeader` for layout. `Eyebrow` shares section-label styling, and `StepNumber` labels the steps in the shopping guide. Keep page-specific backgrounds and illustration styles in `src/styles.css`. Reuse primitives in `src/components/ui/`; combine classes with `cn()`, define variants with class-variance-authority, and use Hugeicons. Product cards have one primary link; images reserve space and show a translated fallback.

**Responsive and accessible.** Check both languages from 320px up; Georgian strings run long, so let flex/grid children shrink and avoid fixed widths. The shell has a skip link and main landmark; keep labels, visible focus, pending/disabled states, status announcements, and reduced-motion support intact. Test loading, empty, error, and success states.

**Localization.** `ka` (default) and `en`. The server reads the HTTP-only `zipwit-locale` cookie before rendering; the language selector saves via a server function and invalidates route data.

- `src/i18n/storefront-ka.ts` maps English source strings to Georgian. Use `useTranslation()` in components and `translate()` (explicit locale) elsewhere.
- `en.ts` / `ka.ts` hold typed messages for forms and custom auth flows; `auth-ka.ts` holds Better Auth UI's Georgian copy.
- `src/lib/price.ts` assembles currency layouts explicitly to keep server and browser output consistent across ICU/CLDR versions. Georgian uses nonbreaking spaces for grouping, a decimal comma, and a trailing currency symbol; English uses comma grouping, a decimal point, and a leading symbol. Use `usePriceFormatter()` in components rather than formatting currency independently. Price-check times use `Asia/Tbilisi`.
- Write Georgian as natural customer-facing copy rather than translating English slogans word for word. Keep the meaning and service claims consistent across languages.
- Preserve `{{placeholder}}` names. Missing translations fall back to the source string; product names are not translated. Keep locale in providers, never module-level globals.

## Development

There is no default Compose file; always pass `-f`.

```sh
# Status
docker compose --env-file .env.development -f docker-compose.dev.yaml ps
# Run checks in the app container
docker compose --env-file .env.development -f docker-compose.dev.yaml exec app pnpm verify
# Rebuild after dependency, Dockerfile, or migration changes
docker compose --env-file .env.development -f docker-compose.dev.yaml up --build
# Stop, keeping volumes
docker compose --env-file .env.development -f docker-compose.dev.yaml down
```

Dev project is `zipwit-dev`, production is `zipwit`; their volumes are separate. `down --volumes` deletes that stack's data.

Host development: Node.js 26.13.1, pnpm 12.21.0, `pnpm install --frozen-lockfile`, plus a reachable Redis service before `pnpm db:migrate` and `pnpm dev`. Start the dev PostgreSQL service and set `DATABASE_URL=postgresql://zipwit:zipwit_dev@127.0.0.1:5432/zipwit` for host-run commands using the default dev password. Compose keeps Redis ports internal.

## Configuration

Compose injects `.env.development` or `.env.production` through each app service’s `env_file`. These are real, untracked files; get values separately on a new machine. The built production Node server does not load an env file itself; supply its process environment through Compose or your service manager. Package DB/maintenance commands use Node's `--env-file-if-exists`, default to development, and honor existing process env; use `NODE_ENV=production pnpm db:migrate` to target production. Validation lives in `src/server/env.server.ts` and `src/db/connection.ts`.

| Variable                                        | Purpose                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                  | PostgreSQL connection URL for host tools and external databases. Compose supplies `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` on its internal network. |
| `POSTGRES_PASSWORD`                             | Set a strong password in the production Compose env file before first startup. Development defaults to `zipwit_dev`.                                                    |
| `REDIS_CLUSTER_NODES`                           | Comma-separated Redis seed URLs. Compose sets all three internal nodes. Credentials belong in the separate variables below.                                             |
| `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS` | Optional shared ACL credentials and TLS, applied to every discovered node.                                                                                              |
| `REDIS_HOST`, `REDIS_PORT`                      | Standalone fallback for host tools when cluster seeds are unset; defaults to `localhost:6379`.                                                                          |
| `BETTER_AUTH_SECRET`                            | Required, at least 32 characters.                                                                                                                                       |
| `BETTER_AUTH_URL`                               | Auth origin. Dev Compose: `http://localhost:3000`; production: your configured storefront origin.                                                                       |
| `SITE_URL`                                      | Public origin for the sitemap; falls back to `BETTER_AUTH_URL`.                                                                                                         |
| `RESEND_API_KEY`                                | Required in production; if absent in dev, emails are logged.                                                                                                            |
| `EMAIL_FROM`                                    | Sender; defaults to `Zipwit Shop <onboarding@resend.dev>`. Set your own for production.                                                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`      | Optional Google sign-in; set both or neither.                                                                                                                           |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`  | Optional Facebook sign-in; set both or neither.                                                                                                                         |
| `CHECKOUT_IBAN`                                 | Receiving IBAN with a valid checksum. Required for new checkouts.                                                                                                       |
| `CHECKOUT_SERVICE_FEE_BPS`                      | Service fee in basis points, from 0 to 10,000; required for new checkouts.                                                                                              |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`        | Required for new checkouts and the notification worker.                                                                                                                 |
| `OPS_ALERT_EMAIL`                               | Optional address for alerts after repeated Telegram delivery failures.                                                                                                  |

Compose's explicit `environment` values override env-file values.

### Catalog administration

Set `CATALOG_ADMIN_USER_IDS` on the shop to a comma-separated list of existing Better Auth user IDs. Apply the database migrations with `pnpm db:migrate`, restart the app with its configuration, and sign in. Open **Catalog feeds** from the account menu or go directly to `/admin`. Operators can add feeds, edit eligibility rules, pause feeds, and delete them. Concurrent edits are checked against the saved revision.

The startup migrations register ShopWSS, Shoe Palace, and Joe’s New Balance Outlet in `/admin`. ShopWSS starts with a verified product page. The other collections stay paused pending a compatible source. [Deal Scout setup](deal-scout/README.md#set-up)

To serve feeds over HTTPS, set the same randomly generated `ZIPWIT_CONFIG_TOKEN` (at least 32 characters) on the shop and the worker. Pass `https://<shop-host>/api/catalog-feeds` to the worker on its existing schedule. Changes take effect on its next run. Pausing a feed leaves previously published offers subject to their recorded expiry.

## Commands

Run with `pnpm` on the host, or prefix with `docker compose --env-file .env.development -f docker-compose.dev.yaml exec app pnpm`.

| Command                  | Purpose                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `dev`                    | Start Vite on port 3000.                                                                                             |
| `build` / `preview`      | Build into `.output` / preview the build.                                                                            |
| `check` / `fix`          | Check formatting and lint / apply automatic fixes.                                                                   |
| `check:deprecations`     | Reject compiler-marked deprecated APIs in project code.                                                              |
| `typecheck`              | Check TypeScript types.                                                                                              |
| `test`                   | Run Vitest.                                                                                                          |
| `verify`                 | Biome CI checks, TypeScript, and tests.                                                                              |
| `knip`                   | Find unused files, exports, and dependencies.                                                                        |
| `db:generate`            | Generate a migration from schema changes.                                                                            |
| `db:migrate`             | Apply pending migrations.                                                                                            |
| `db:push`                | Apply the schema directly, without a migration file.                                                                 |
| `db:studio`              | Open Drizzle Studio.                                                                                                 |
| `db:seed`                | Populate sample development catalog data.                                                                            |
| `checkout:notifications` | Deliver queued order notifications and clean expired drafts without evidence.                                        |
| `search:sync`            | Rebuild derived Search documents from Redis catalog records.                                                         |
| `catalog:check`          | Verify catalog publication, Redis reads, updates, expiry, carts and cross-shard cleanup against disposable services. |
| `search:check`           | Check Redis Search and JSON support using a temporary test index.                                                    |

Redis needs the Search and JSON modules; Compose uses `redis:8.10.3-alpine`.

## Production

The production stack builds the app, runs migrations, and serves it through Nginx. Port 80 redirects to HTTPS on 443; Nginx serves built assets directly and proxies the rest to Node.

**Before starting**

1. Configure `.env.production` with a strong `POSTGRES_PASSWORD`, a distinct `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.
2. Set `BETTER_AUTH_URL` and `SITE_URL` to your public HTTPS origin.
3. Provide `certs/fullchain.pem` and `certs/privkey.pem` (real files, not symlinks). Nginx uses these for HTTPS.
4. To accept orders, configure the receiving IBAN, service fee, Telegram destination, and confirmed warehouse shipping rules. See [Checkout](#checkout).

**Startup order**

```mermaid
flowchart LR
    Volume[(PostgreSQL ready)] --> Migrate[Migrations succeed]
    Migrate --> App
    Redis[Redis Cluster initialized] --> App[App healthy]
    App --> Web[Nginx]
    Migrate --> Worker[Checkout notification worker]
```

Compose starts Nginx after `/api/ready` can query the migrated checkout schema and read a key from Redis. It continues polling that endpoint while the app runs. `/api/health` reports process liveness independently. A later readiness failure marks the container unhealthy. Nginx continues forwarding requests to the running app.

```sh
# Validate config without printing secrets
docker compose --env-file .env.production -f docker-compose.prod.yaml config --quiet
# Build and start / deploy updated code
docker compose --env-file .env.production -f docker-compose.prod.yaml up -d --build
# Inspect status and logs
docker compose --env-file .env.production -f docker-compose.prod.yaml ps -a
docker compose --env-file .env.production -f docker-compose.prod.yaml logs --tail=100 migrate app web checkout-notifications
# Stop, keeping data
docker compose --env-file .env.production -f docker-compose.prod.yaml down
```

The runtime image contains only the built app. Run source-based scripts through the `migrate` service, which keeps the source and tooling:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yaml run --rm migrate pnpm search:sync
```

## Repository layout

| Path                                    | Contents                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `src/routes/`                           | File-based routes, loaders, server endpoints.                              |
| `src/features/`                         | Catalog, search, stores, cart, checkout, shipping, auth, addresses, stats. |
| `src/components/`                       | Shared UI, forms, layout, homepage.                                        |
| `src/i18n/`                             | Messages, locale state, persistence.                                       |
| `src/data/`                             | Taxonomy, types, sizes, site info.                                         |
| `src/db/`, `drizzle/`                   | Connection, schema, migration history.                                     |
| `src/server/`                           | Env validation, Redis client, cache helpers.                               |
| `scripts/`                              | Seeding, search sync, integration checks.                                  |
| `docker-compose.*.yaml`, `nginx.*.conf` | Per-environment service and proxy config.                                  |
| `vite.config.ts`, `vitest.config.ts`    | Separate app build and unit-test configs.                                  |
| `.github/workflows/ci.yml`              | CI checks and Redis Search integration check.                              |

## Testing

Database tests create and drop uniquely named databases. Point `TEST_DATABASE_URL` at a local PostgreSQL role with `CREATEDB` privileges. The storefront tests default to the dev Compose database on port 5432. Export the same test URL for the Python suite.

```sh
pnpm verify && pnpm check:deprecations && pnpm knip && pnpm build && pnpm search:check
```

`verify` covers Biome, TypeScript, and storefront unit tests. CI also runs ty, Ruff, and Deal Scout’s Python tests against its locked dependencies. `search:check` needs Redis with Search and JSON (use the container prefix under Compose). [Run the Deal Scout checks locally](deal-scout/README.md#verify)

Unit tests live in `test/`, mirror the layout of `src/`, and use the `*.test.ts` or `*.test.tsx` suffix. The separate Node-based Vitest config keeps Start and Nitro RPC transforms out of the unit tests so they can mock server boundaries. `check:deprecations` reads TypeScript's suggestion diagnostics, which depend on the installed TypeScript version.

Shipping tests cover per-warehouse thresholds, multiple paid shipments, quantity changes, GEL conversion, missing or invalid rules, and saved-quote compatibility.

Store tests cover route scoping, anonymous identifiers in product responses, and store filters in catalog search; `search:check` also exercises store filtering against Redis. Price tests cover locale-specific output, currency placement, grouping, and negative amounts.

Cart unit tests mock Redis reads. Checkout persistence tests run migrations and transactions in PostgreSQL with fixture cart and payment data.

The cart recovery script (`scripts/cart-check.ts`) uses a dedicated expiring Redis key. It leaves visitor carts alone.

CI runs on pushes to `main` and pull requests with isolated PostgreSQL databases and a three-primary Redis Cluster. It exercises search, catalog writes, and cart recovery. It starts the built Node app, checks readiness before and after applying migrations, and requests the guest checkout page. For UI work, also check both languages at mobile, tablet, and desktop widths, keyboard use, dialog dismissal, and loading and empty states.

## Extending

### Add a feature or route

1. Put feature logic in `src/features/<feature>/`; shared primitives in `src/components/`.
2. Validate untrusted server-function input with `.validator()`; enforce ownership in the handler.
3. Implement in `*.server.ts`, expose through `*.functions.ts`. Keep secrets out of browser config and props.
4. Define keys and options in `*.queries.ts`; use `.query()` / `.infiniteQuery()` in loaders and forward abort signals.
5. Add the route with validated params/search, metadata, and pending/error/empty states. Let the route tree regenerate.
6. Use `useServerFn` for mutations and refresh affected queries after writes.
7. Add copy in both languages and regression tests.

### Change the database or catalog

```sh
pnpm db:generate   # after editing the Drizzle schema; review SQL and snapshot
pnpm db:migrate    # apply to the selected dev database
pnpm search:sync   # refresh derived search data
```

The initial migration is included in `drizzle/`. Generate a new migration with `pnpm db:generate` after schema changes, then apply it with `pnpm db:migrate`.

Commit schema changes with their migration files. Use `db:push` only on disposable databases, and review renames and destructive operations first.

New departments or categories change the taxonomy: update `src/data/catalog.ts`, labels/translations, navigation, and `department-tiles.tsx` (visual tone). Changes to search fields also require updating the document builder, field definitions, queries, and tests.

### Change brand content

Edit `src/data/site.ts` (brand copy, currency, time zone) and `src/data/socials.ts`; adjust tokens in `src/styles.css`. Keep `src/i18n/` in sync and don't present unimplemented services as available actions.

Replace the social platform homepages in `src/data/socials.ts` with the shop’s profile URLs when they are available.

The shopping guide lives in `src/components/home/how-it-works.tsx`. The About route renders the interactive selection process from `src/components/about/selection-process.tsx`, with native HTML disclosures. Keep the shopper instructions distinct from the store-selection story. Footer links live in `src/components/layout/footer.tsx`; Georgian storefront copy lives in `src/i18n/storefront-ka.ts`. Update page metadata and translations when changing the story, and retain keyboard and reduced-motion behavior when adjusting the layout.

## Troubleshooting

| Symptom                                            | Check                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compose reports missing variables                  | Set matching `--env-file` / `-f` values; see [Configuration](#configuration).                                                                    |
| App won't start or Nginx returns 502               | `... ps -a`, then check `migrate`, `app`, `web` logs. A failed migration blocks the app.                                                         |
| `Permission denied` on mounted files (Fedora/RHEL) | Keep SELinux bind-mount labels; inspect denials with `sudo ausearch -m avc -ts recent`.                                                          |
| Host commands can't reach Redis                    | Ports aren't published. Run commands in the app container or provide separate services.                                                          |
| Catalog is empty                                   | Write products with `putCatalogProduct`, or seed dev only. Inspect all Redis nodes and the init service.                                         |
| Unknown `FT.*` or `JSON.*` command                 | Redis lacks the modules. Use the configured image and run `search:check`.                                                                        |
| Stale products or prices                           | Write a fresh timestamped catalog revision, then wait out or invalidate the client cache. `search:sync` only rebuilds derived Redis Search data. |
| Verification email missing                         | Dev without Resend: check app logs. Production: check the Resend key and sender.                                                                 |
| Social sign-in missing                             | Set both ID and secret, callback settings, and the correct public auth origin.                                                                   |
| New route not recognized                           | Run the Vite dev/build flow to regenerate `src/routeTree.gen.ts`, then typecheck.                                                                |
| Shipping is unavailable for a shipment             | Query `warehouse_shipping_rule` by exact domain in PostgreSQL. Check the rate and free-shipping threshold in USD cents.                          |
| Shipping preview has no estimate                   | GEL carts need a valid NBG rate; check outbound access and rate-service logs. USD carts do not need conversion for estimates.                    |
| Checkout is temporarily unavailable                | Check IBAN, service fee, Telegram settings, and NBG access. See [checkout settings](#checkout).                                                  |
| Saved checkout still shows old shipping            | Expected: existing quotes are frozen. Start a new checkout to use updated rules.                                                                 |
| Unit tests start Nitro or generate RPC calls       | Make sure Vitest loads `vitest.config.ts`; don't merge app server plugins into it.                                                               |

`/api/health` is liveness only: it shows the process answers HTTP, not that search, PostgreSQL, email, or checkout work.

## Known limitations

- **Payment and fulfillment:** bank transfers are verified manually. There is no card processor, sales-tax engine, stock reservation, fulfillment integration, or order-management dashboard. Shipping is limited to U.S. addresses.
- **Shipping rules:** only predictable per-warehouse flat rates and optional thresholds are supported. Configure real rates before checkout; weight, regional surcharges, and coupon-dependent shipping are not modeled.
- **Catalog ingestion.** The generic adapter reads embedded JSON-LD offers. Stores with other offer formats need an adapter. Gemini can find product reviews on other sites. Supplier rechecks run through the operator CLI, and checkout accepts only purchasable listings.
- **Operational durability:** three Redis primaries use AOF persistence but have no replicas or automatic failover. No automated backups or restore drills. Redis loss also affects carts and auth secondary state.
- **Verification scope:** CI has unit tests, a Redis Search check, and Redis Cluster integration checks. It has no complete cart/auth/browser end-to-end suite or formal accessibility certification.
