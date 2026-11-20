"""Discovery and catalog publication outcomes."""

import io
import subprocess
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import replace
from pathlib import Path
from unittest.mock import Mock, patch

from scout_fixtures import FEED, POSITIVE, PRODUCT, candidate_for, observed

from deal_scout.pipeline import main, run
from deal_scout.reviews import (
    ReviewError,
    Verdict,
)


class PublicationTests(unittest.TestCase):
    def test_empty_config_skips_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "feeds.json"
            config.write_text("[]", encoding="utf-8")
            with (
                patch("sys.argv", ["zipwit-deals", str(config), "--publish"]),
                patch.dict("os.environ", {}, clear=True),
                patch("deal_scout.pipeline.run") as crawl,
                redirect_stderr(io.StringIO()),
            ):
                main()
                crawl.assert_not_called()

    def test_empty_active_feed_reports_failure(self):
        for rows in ([], [observed({"@type": "Product", "name": "missing ID"})]):
            with (
                self.subTest(rows=rows),
                patch(
                    "deal_scout.pipeline.collect_pages",
                    return_value=(rows, 0),
                ),
                redirect_stdout(io.StringIO()) as output,
                redirect_stderr(io.StringIO()),
            ):
                self.assertEqual(run([FEED], self.fail), 1)
                self.assertEqual(output.getvalue(), "")

    def test_writer_failure_isolated_by_warehouse(self):
        row = observed(PRODUCT)
        second = replace(row, source_url="https://second.example/trainer")
        with (
            patch(
                "deal_scout.pipeline.collect_pages",
                side_effect=[([row], 0), ([second], 0)],
            ),
            patch("deal_scout.pipeline.remember_sources") as remember,
            patch(
                "deal_scout.pipeline.publish",
                side_effect=[
                    subprocess.CalledProcessError(1, "node"),
                    None,
                ],
            ) as publish,
            redirect_stderr(io.StringIO()),
        ):
            self.assertEqual(
                run(
                    [FEED, FEED.model_copy(update={"warehouse": "second.example"})],
                    lambda _: POSITIVE,
                    shop=Path("."),
                    db=Mock(),
                ),
                1,
            )
            self.assertEqual(publish.call_count, 2)
            remember.assert_called_once()
            self.assertEqual(
                remember.call_args.args[1][0][1], publish.call_args.args[0][0]["id"]
            )

    def test_review_failure_isolated_by_product(self):
        failed = observed({**PRODUCT, "productGroupID": "failed"})
        eligible = observed(PRODUCT)
        withdrawn = observed({**PRODUCT, "productGroupID": "withdrawn", "review": []})
        analyze = Mock(
            side_effect=[
                ReviewError("timeout"),
                POSITIVE,
                Verdict(sentiment="negative"),
            ]
        )
        with (
            patch(
                "deal_scout.pipeline.collect_pages",
                return_value=([failed, eligible, withdrawn], 0),
            ),
            patch("deal_scout.pipeline.publish") as publish,
            redirect_stderr(io.StringIO()),
        ):
            status = run([FEED], analyze, shop=Path("."))
        self.assertEqual(status, 1)
        publish.assert_called_once()
        records, _ = publish.call_args.args
        self.assertEqual(
            [(record["id"], len(record["skus"])) for record in records],
            [
                (candidate_for(eligible).record["id"], 1),
                (candidate_for(withdrawn).record["id"], 0),
            ],
        )
