"""Shopper evidence, Gemini responses and verdict caching."""

import io
import json
import unittest
from copy import deepcopy
from unittest.mock import Mock, patch

from scout_fixtures import FEED, POSITIVE, PRODUCT, candidate_for, observed

from deal_scout.pipeline import evaluate_feeds, qualify
from deal_scout.reviews import (
    ReviewAnalyzer,
    ReviewError,
    Verdict,
    parse_verdict,
)


class SentimentTests(unittest.TestCase):
    def test_rating_is_optional(self):
        product = deepcopy(PRODUCT)
        del product["review"]
        for rating in [
            {},
            {"aggregateRating": {"ratingValue": 1, "reviewCount": 1}},
            {"aggregateRating": "invalid"},
        ]:
            with self.subTest(rating=rating):
                row = observed(
                    {**product, **rating, "brand": {"name": "Example"}, "mpn": "CT-7"}
                )
                analyze = Mock(return_value=Verdict(sentiment="unknown"))
                records, errors, _ = evaluate_feeds([(FEED, [row])], analyze)
                self.assertEqual(errors, 0)
                self.assertEqual(len(records[0]["skus"]), 1)
                analyze.assert_called_once()
                evidence = analyze.call_args.args[0]
                self.assertEqual(
                    (
                        evidence.name,
                        evidence.brand,
                        evidence.retailer_product_id,
                        evidence.mpn,
                        evidence.source_url,
                        evidence.excerpts,
                    ),
                    ("Court Trainer", "Example", "trainer", "CT-7", row.source_url, ()),
                )

    def test_excludes_other_products_reviews(self):
        row = observed(
            {
                **PRODUCT,
                "review": [
                    {
                        "reviewBody": "Terrible",
                        "itemReviewed": {"sku": "different-shoe"},
                    },
                    {
                        "reviewBody": "Sturdy",
                        "itemReviewed": {"productGroupID": "trainer"},
                    },
                ],
            }
        )
        self.assertEqual(candidate_for(row).evidence.excerpts, ("Sturdy",))

    def test_excerpt_limits_and_duplicates(self):
        prefix = "é" * 1000
        bodies = [None, 5, "", "  First  ", "First", prefix + "A", prefix + "B"]
        bodies.extend(f"Review {i}" for i in range(15))
        row = observed({**PRODUCT, "review": [{"reviewBody": body} for body in bodies]})
        analyze = Mock(return_value=POSITIVE)
        self.assertTrue(qualify(candidate_for(row), analyze)["skus"])
        self.assertEqual(
            analyze.call_args.args[0].excerpts,
            ("First", prefix, *(f"Review {i}" for i in range(10))),
        )

    def test_negative_is_the_only_rejecting_verdict(self):
        candidate = candidate_for(observed(PRODUCT))
        for sentiment in ("positive", "negative", "mixed", "neutral", "unknown"):
            with self.subTest(sentiment=sentiment):
                verdict = Verdict.model_validate({"sentiment": sentiment})
                record = qualify(candidate, Mock(return_value=verdict))
                self.assertEqual(record["browseOnly"], sentiment == "negative")
                self.assertEqual(
                    record["skus"],
                    [] if sentiment == "negative" else candidate.record["skus"],
                )

    def test_web_reviews_without_retailer_excerpts(self):
        product = candidate_for(observed({**PRODUCT, "review": []})).evidence
        reply = {
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {"parts": [{"text": '{"sentiment":"negative"}'}]},
                    "groundingMetadata": {
                        "groundingChunks": [
                            {"web": {"uri": "https://reviews.example/trainer"}}
                        ]
                    },
                }
            ]
        }
        db = Mock()
        db.execute.return_value.fetchone.return_value = None
        with patch("deal_scout.reviews.build_opener") as opener:
            opener.return_value.open.return_value = io.BytesIO(
                json.dumps(reply).encode()
            )
            analyzer = ReviewAnalyzer(db, "test-model", "test-key", 1)
            verdict = analyzer.analyze(product)
            self.assertEqual(verdict.sentiment, "negative")
            request = opener.return_value.open.call_args.args[0]
            payload = json.loads(request.data)
            self.assertEqual(payload["tools"], [{"googleSearch": {}}])
            query = json.loads(payload["contents"][0]["parts"][0]["text"])
            self.assertEqual(
                (query["name"], query["source_url"], query["excerpts"]),
                ("Court Trainer", product.source_url, []),
            )
        del reply["candidates"][0]["groundingMetadata"]
        self.assertEqual(parse_verdict(reply, has_excerpts=False).sentiment, "unknown")

    def test_invalid_replies_fail_analysis(self):
        valid_part = {"text": POSITIVE.model_dump_json()}
        for candidate in [
            None,
            {"finishReason": "SAFETY"},
            {"finishReason": "MAX_TOKENS", "content": {"parts": [valid_part]}},
            {
                "finishReason": "STOP",
                "content": {"parts": [{**valid_part, "thought": True}]},
            },
            {"finishReason": "STOP", "content": {"parts": [{"text": "invalid"}]}},
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": '{"fit":"true_to_size"}'}]},
            },
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": '{"sentiment":"invalid"}'}]},
            },
        ]:
            with self.subTest(candidate=candidate), self.assertRaises(ReviewError):
                parse_verdict({"candidates": [candidate]}, has_excerpts=False)
