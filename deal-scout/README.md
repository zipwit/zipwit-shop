# Deal Scout

Deal Scout finds products on configured U.S. retailer pages, checks exact offers, uses Gemini with Google Search to find shopper reviews and assess product sentiment, and publishes qualifying variants to Zipwit's Redis catalog. Each invocation runs one pass. The existing storefront reads the resulting prices, sizes, stock, and search documents.

## Architecture

```mermaid
flowchart TD
    Admin[Shop admin panel] -->|Serves the feed over HTTPS| Feed[Store URLs and deal rules]
    Local[Operator edits local JSON] --> Feed
    Feed --> Crawl[Crawlee fetches listings and product pages]
    Crawl --> Filter[Python checks stock and the minimum discount]
    Filter -->|Eligible discounted variant| Cache{Cached verdict?}
    Cache -->|Hit| Sentiment{Negative shopper sentiment?}
    Cache -->|Miss within budget| Gemini[Gemini searches for reviews of the exact product]
    Gemini -->|Save sentiment in PostgreSQL| Sentiment
    Filter -->|Identifiable product fails the rules| Withdraw[Withdraw product]
    Sentiment -->|Yes| Withdraw
    Sentiment -->|No| Publish[Publish eligible SKUs]
    Withdraw --> Writer[Trusted Node catalog writer]
    Publish --> Writer
    Writer --> Redis[(Redis product records and Search)]
    Redis --> Shop[Storefront and cart]
```

The diagram shows a pass with `--publish`. Crawlee supplies the retailer evidence. Python owns prices, stock, identity, and eligibility rules. Gemini searches for reviews once the product has an eligible offer and considers any shopper excerpts embedded on the retailer page. PostgreSQL caches verdicts and stores the discovery feeds for each published SKU. The Node writer owns Redis updates so detail pages, SKU lookups, and search all use the same observation.

An observed rule failure produces a withdrawal. A failed fetch, exhausted model budget, or unusable model reply leaves the previous observation to expire. An operator rechecks each quoted SKU at its unit price before requesting a transfer, verifies payment, and places the retailer order manually. The recheck uses the same crawler and rules as discovery. [Recheck command](#recheck-before-payment)

## Set up

From the repository root, install the shop dependencies with `pnpm install --frozen-lockfile`. The publisher runs the repository's Node/tsx catalog writer and uses the same Redis and auth settings as the shop. For development, start the shop's PostgreSQL and Redis services and make sure their addresses are reachable from the worker. Configure the warehouse's shipping rate under its exact domain before taking orders.

```sh
cd deal-scout
uv python install 3.15.2
uv sync --locked
export DATABASE_URL=postgresql://zipwit:zipwit_dev@127.0.0.1:5432/zipwit
```

When you open the shop root in your editor, the repository's `ty.toml` points ty to `deal-scout/.venv` and `deal-scout/src`. On a fresh checkout, `uv sync --locked --project deal-scout` from the shop root creates that environment.

Use the shop’s `pnpm db:migrate` to create the PostgreSQL tables. The development URL above uses the default Compose password. For another PostgreSQL deployment, set the worker’s `DATABASE_URL` or libpq connection variables.

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in the worker environment. Choose a model that supports Google Search and structured JSON together with `generateContent`. The worker defaults to **20 fresh model calls per invocation**. Account quotas and billing depend on the selected model and Google project. [Gemini structured outputs with tools](https://ai.google.dev/gemini-api/docs/structured-output#tools) · [API pricing](https://ai.google.dev/gemini-api/docs/pricing)

## Configure a feed

Replace the example domain, URLs, and CSS selector with a retailer whose pages you may crawl. Use one feed per department and category. A feed with `product_link_selector` visits each listing URL and follows matching same-origin product links one level deep. Omit the selector to visit product URLs directly. Add further listing pages to `urls` for pagination. Crawlee honors robots.txt access rules and limits concurrency to two. Its default queue does not enforce crawl-delay directives.

Set the minimum discount percentage and maximum stock age in minutes. Departments are `women`, `men`, and `kids`. Categories are `shoes`, `clothing`, and `accessories`. Choose focused collection URLs so those labels apply to every product in the feed. [Feed example](feeds.example.json)

With no config argument, Deal Scout loads enabled feeds from PostgreSQL. To use the HTTPS endpoint instead, set `ZIPWIT_CONFIG_TOKEN` on both the shop and worker. Pass `https://<shop-host>/api/catalog-feeds` in place of the file path. The endpoint returns active feeds. A discovery run with an empty list exits successfully without crawling or calling Gemini. [Configure operator access](../README.md#catalog-administration)

## Preview and publish

```sh
uv run --locked zipwit-deals
uv run --locked zipwit-deals --publish --max-gemini-calls 10
```

Preview prints newline-delimited catalog snapshots. Publishing runs the catalog writer automatically. A snapshot with empty SKUs withdraws that product from Redis details, SKU lookups, and search. Observation timestamps prevent delayed runs from restoring an older price or withdrawn deal. For recurring refreshes, run the publish command with a scheduler at an interval shorter than `max_age_minutes`. Use `--shop` to point an independently installed worker at the shop checkout.

The starter migrations register three men’s footwear feeds. ShopWSS starts with a direct product page. Deal Scout reads that page’s USD offer and embedded size-level prices, markdowns, and stock. Add verified product URLs to expand the feed. Shoe Palace and Joe’s New Balance Outlet start paused pending a compatible source. Use `--preview-feed ID` to check a saved feed. Enter a confirmed shipping rule before taking orders.

| Warehouse                                                                                  | Preview ID                             |
| ------------------------------------------------------------------------------------------ | -------------------------------------- |
| [ShopWSS](https://www.shopwss.com/products/100283962-reebok-zig-dynamica-6-mens-black-red) | `a8d035f4-66a9-5817-bd83-dd555e8c770c` |
| [Shoe Palace](https://www.shoepalace.com/collections/mens-sale-shoes)                      | `c2caa296-38cf-5f4e-bf82-e5e549ee373e` |
| [Joe’s New Balance Outlet](https://www.joesnewbalanceoutlet.com/men/shoes/all-shoes/)      | `222c6e06-1162-554f-bde7-8f96534609dd` |

The Compose worker runs on the same network as PostgreSQL and the Redis cluster. From the repository root:

```sh
docker compose --env-file .env.development -f docker-compose.dev.yaml run --rm --build deal-scout --preview-feed a8d035f4-66a9-5817-bd83-dd555e8c770c
docker compose --env-file .env.development -f docker-compose.dev.yaml run --rm deal-scout --publish
```

### What qualifies

- A page supplies a JSON-LD `Product` or a `ProductGroup` with its variants embedded. The adapter expects a stable product or group ID (or standalone SKU), a name, and exact variant SKU, size, and color.
- Each accepted variant has one in-stock USD `Offer`, a current price, and an explicit `StrikethroughPrice` in `priceSpecification`. Python converts to cents and checks the unrounded discount. Offer validity and availability windows must cover the observation. Their end times cap the stored expiry. Quantity limits must allow one item. Member-only prices and minimum-spend offers are excluded.
- Gemini searches for shopper reviews across sites using the product name, source URL, retailer ID, and available brand and manufacturer part number. It also receives up to 12 distinct retailer excerpts of 1,000 characters each. Only negative sentiment withdraws an otherwise eligible product. Positive, neutral, mixed and unknown sentiment qualify, including when the search finds no matching reviews. If there are no retailer excerpts, a sentiment judgment requires a web source in Gemini’s grounding metadata. The worker caches the result for 24 hours for the same product, excerpts, model and prompt.
- If a page or Gemini request fails, existing offers keep their previous expiry. A fetched, identifiable product that no longer qualifies is withdrawn. Within a warehouse, the newest observation is evaluated against the active feeds that discovered the product. Qualifying sizes from those rules share one snapshot. A partial crawl across overlapping feeds reports failure and skips that warehouse. If observations at that timestamp disagree, the worker withdraws the product and reports the conflict.
- A blocked page, listing with no matching links, or product page with no identifiable product gives the pass a nonzero exit status. Other products can still publish. An active feed that yields no products also reports failure, including when the retailer collection is genuinely empty. A failed catalog writer reports failure and the worker continues to the next warehouse.

Inspect a retailer before configuring its feed. This command runs without Gemini or Redis and shows the structured data the adapter can read.

```sh
uv run --locked zipwit-crawl https://outlet.example/products/trainer --output products.json
```

Some stores omit crossed-out prices from JSON-LD or split a group's variants across several pages. Those stores need a retailer-specific adapter before this worker can reliably list their deals.

## Recheck before payment

Use the supplier URL, the catalog SKU UUID from the quote, and the quoted **unit price in USD cents**. New checkout sessions save the supplier URLs by SKU in the private PostgreSQL column `checkout_session.supplier_pages`. Look up the session by its payment reference (also the order ID). These links survive catalog withdrawal. The SKU’s saved discovery scopes select the applicable active rules across the warehouse. If there is no saved association, Deal Scout checks collection membership before evaluating the supplier page.

```sh
uv run --locked zipwit-deals --publish \
  --recheck https://outlet.example/products/trainer \
  --sku 12345678-1234-5678-9123-123456789abc --expected-cents 4999
```

Exit code zero confirms the exact SKU is currently eligible at the quoted price. A changed price, missing size, or failed check exits nonzero. With `--publish`, an observed price or stock change also updates the storefront. Recheck each quoted SKU before requesting a transfer. This is an operator command. The checkout UI does not invoke it, and the retailer purchase is still manual. Retailer stock can change after a check.

## Verify

```sh
export TEST_DATABASE_URL=postgresql://zipwit:zipwit_dev@127.0.0.1:5432/zipwit
uv run --locked ty check --project ..
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked python -m unittest discover -s tests -v
```

The tests exercise price and stock filtering, conflicting offers, review evidence, Gemini budgeting and caching, publication failures, and the pre-payment check. A local HTTP fixture runs the real crawler through discovery, repeat visits, selector changes, malformed product data, and robots.txt restrictions.
