"""Quote confirmation, overlapping feeds and conflicting observations."""

import io
import os
import unittest
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import Mock, patch

import psycopg
from scout_fixtures import FEED, POSITIVE, PRODUCT, candidate_for, observed

from deal_scout.pipeline import QuoteRecheck, evaluate_feeds, run
from deal_scout.reviews import (
    ReviewError,
)


class QuoteRecheckTests(unittest.TestCase):
    def test_legacy_quote_withdraws_sold_out_product(self):
        row = observed(PRODUCT)
        record = candidate_for(row).record
        sku = record["skus"][0]
        quote = QuoteRecheck(row.source_url, sku["id"], sku["price"])
        sold_out = deepcopy(PRODUCT)
        sold_out["hasVariant"][0]["offers"]["availability"] = "OutOfStock"
        other = observed({**PRODUCT, "productGroupID": "other"})
        feed = FEED.model_copy(
            update={"urls": [row.source_url], "product_link_selector": None}
        )
        with (
            patch(
                "deal_scout.pipeline.collect_pages",
                return_value=([other, observed(sold_out)], 0),
            ),
            patch("deal_scout.pipeline.publish") as writer,
            redirect_stderr(io.StringIO()),
        ):
            self.assertEqual(run([feed], self.fail, recheck=quote, shop=Path(".")), 1)
            records, _ = writer.call_args.args
            self.assertEqual(
                [(item["id"], item["skus"]) for item in records], [(record["id"], [])]
            )

    def test_conflicting_observations_withdraw_product(self):
        row = observed(PRODUCT)
        sold_out = deepcopy(PRODUCT)
        sold_out["hasVariant"][0]["offers"]["availability"] = "OutOfStock"
        contradiction = replace(row, product=sold_out)
        sku = candidate_for(row).record["skus"][0]
        quote = QuoteRecheck(row.source_url, sku["id"], sku["price"])
        for pair in ([row, contradiction], [contradiction, row]):
            with self.subTest(pair=pair), redirect_stderr(io.StringIO()):
                records, failed, _ = evaluate_feeds([(FEED, pair)], self.fail)
                self.assertEqual((failed, len(records), records[0]["skus"]), (1, 1, []))
                self.assertFalse(quote.matches(records, datetime.now(UTC)))

        older = replace(row, checked_at="2020-01-01T00:00:00.000Z")
        records, failed, _ = evaluate_feeds([(FEED, [contradiction, older])], self.fail)
        self.assertEqual((failed, len(records), records[0]["skus"]), (0, 1, []))
        analyze = Mock(return_value=POSITIVE)
        records, failed, _ = evaluate_feeds([(FEED, [row, row])], analyze)
        self.assertEqual((failed, len(records)), (0, 1))
        analyze.assert_called_once()

    def test_quote_requires_current_sku_and_price(self):
        row = observed(PRODUCT)
        sku = candidate_for(row).record["skus"][0]
        quote = QuoteRecheck(row.source_url, sku["id"], sku["price"])
        analyze = Mock(return_value=POSITIVE)
        with (
            patch("deal_scout.pipeline.collect_pages", return_value=([row], 0)),
            redirect_stdout(io.StringIO()),
            redirect_stderr(io.StringIO()),
        ):
            self.assertEqual(run([FEED], analyze, recheck=quote), 0)
            changed = replace(quote, unit_price_cents=quote.unit_price_cents + 1)
            self.assertEqual(run([FEED], analyze, recheck=changed), 1)
            analyze.side_effect = ReviewError("Gemini request failed")
            self.assertEqual(run([FEED], analyze, recheck=quote), 1)

    def test_saved_sku_uses_its_discovery_feeds(self):
        strict = FEED.model_copy(
            update={
                "category": "clothing",
                "rules": FEED.rules.model_copy(update={"min_discount_percent": 90}),
            }
        )
        unrelated = FEED.model_copy(update={"category": "accessories"})
        row = observed(PRODUCT)
        earlier = replace(row, checked_at="2020-01-01T00:00:00.000Z")
        sku = candidate_for(row).record["skus"][0]
        quote = QuoteRecheck(row.source_url, sku["id"], sku["price"])
        with psycopg.connect(os.environ["TEST_DATABASE_URL"], autocommit=True) as db:
            db.execute(
                "CREATE TEMP TABLE deal_source (sku_id text PRIMARY KEY,product_id text,observed_at timestamptz,scopes text[])"
            )
            with (
                patch(
                    "deal_scout.pipeline.collect_pages",
                    side_effect=[([earlier], 0), ([row], 0)],
                ),
                patch("deal_scout.pipeline.publish") as writer,
            ):
                self.assertEqual(
                    run([FEED, strict], lambda _: POSITIVE, shop=Path("."), db=db), 0
                )
                records, _ = writer.call_args.args
                self.assertEqual(
                    [(r["category"], len(r["skus"])) for r in records], [("shoes", 1)]
                )
            with (
                patch(
                    "deal_scout.pipeline.collect_pages", return_value=([row], 0)
                ) as crawl,
                redirect_stdout(io.StringIO()),
                redirect_stderr(io.StringIO()),
            ):
                self.assertEqual(
                    run(
                        [unrelated, strict, FEED],
                        lambda _: POSITIVE,
                        recheck=quote,
                        db=db,
                    ),
                    0,
                )
                crawl.assert_awaited_once_with([row.source_url], max_pages=1)
                self.assertEqual(
                    run([strict, unrelated], self.fail, recheck=quote, db=db), 1
                )
            other = observed({**PRODUCT, "productGroupID": "other"})
            records, failed, _ = evaluate_feeds(
                [(strict, [row]), (FEED, [other])], lambda _: POSITIVE, db=db
            )
            self.assertEqual((failed, len(records[0]["skus"])), (0, 1))
