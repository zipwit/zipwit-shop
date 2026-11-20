"""Persistent cache lifetime, budgets and concurrent sentiment decisions."""

import io
import json
import os
import unittest
from dataclasses import replace
from unittest.mock import patch

import psycopg
from scout_fixtures import POSITIVE, PRODUCT, candidate_for, observed

from deal_scout.reviews import ReviewAnalyzer, ReviewError, Verdict
from deal_scout.settings import NoRedirect


class VerdictCacheTests(unittest.TestCase):
    def setUp(self):
        self.db = self.enterContext(
            psycopg.connect(os.environ["TEST_DATABASE_URL"], autocommit=True)
        )
        self.db.execute(
            "CREATE TEMP TABLE review_verdict (key text PRIMARY KEY, verdict jsonb NOT NULL, checked_at timestamptz NOT NULL DEFAULT now())"
        )

    def test_cache_scope_and_expiry(self):
        reply = {
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {"parts": [{"text": POSITIVE.model_dump_json()}]},
                }
            ]
        }
        with patch("deal_scout.reviews.build_opener") as opener:
            product = candidate_for(observed(PRODUCT)).evidence
            opener.return_value.open.return_value = io.BytesIO(
                json.dumps(reply).encode()
            )
            analyzer = ReviewAnalyzer(self.db, "test-model", "test-key", 1)
            self.assertEqual(analyzer.analyze(product), POSITIVE)
            next_run = ReviewAnalyzer(self.db, "test-model", "test-key", 0)
            self.assertEqual(next_run.analyze(product), POSITIVE)
            with self.assertRaisesRegex(ReviewError, "budget"):
                analyzer.analyze(replace(product, excerpts=("new evidence",)))
            different_model = ReviewAnalyzer(self.db, "other-model", "test-key", 0)
            with self.assertRaisesRegex(ReviewError, "budget"):
                different_model.analyze(product)
            opener.return_value.open.assert_called_once()
            self.assertIsInstance(opener.call_args.args[0], NoRedirect)
            with self.assertRaisesRegex(ReviewError, "budget"):
                next_run.analyze(replace(product, retailer_product_id="other"))
            self.db.execute(
                "UPDATE review_verdict SET checked_at = now() - interval '2 days'"
            )
            with self.assertRaisesRegex(ReviewError, "budget"):
                next_run.analyze(product)
            reply["candidates"][0]["content"]["parts"] = [
                {"text": '{"sentiment":"negative"}'}
            ]
            opener.return_value.open.return_value = io.BytesIO(
                json.dumps(reply).encode()
            )
            refreshed = ReviewAnalyzer(self.db, "test-model", "test-key", 1)
            self.assertEqual(refreshed.analyze(product).sentiment, "negative")
            self.assertEqual(next_run.analyze(product).sentiment, "negative")

    def test_concurrent_searches_use_the_stored_verdict(self):
        evidence = candidate_for(observed(PRODUCT)).evidence
        first = ReviewAnalyzer(self.db, "model", "key", 1)
        second = ReviewAnalyzer(self.db, "model", "key", 1)

        def reply(verdict: Verdict):
            return {
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": verdict.model_dump_json()}]},
                    }
                ]
            }

        def finish_after_second(*_):
            self.assertEqual(second.analyze(evidence), POSITIVE)
            return reply(Verdict(sentiment="negative"))

        with (
            patch.object(first, "_request", side_effect=finish_after_second),
            patch.object(second, "_request", return_value=reply(POSITIVE)),
        ):
            self.assertEqual(first.analyze(evidence), POSITIVE)
            self.assertEqual(first.analyze(evidence), POSITIVE)
