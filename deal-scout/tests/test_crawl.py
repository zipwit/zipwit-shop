"""Exercise the production HTTP crawler against a local retailer fixture."""

import asyncio
import json
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from deal_scout.crawl import collect_pages
from deal_scout.deals import reviews_for


class CrawlTests(unittest.TestCase):
    def setUp(self):
        self.fetched = []
        fetched = self.fetched
        product = {
            "@type": "Product",
            "sku": "trainer",
            "name": "Court Trainer",
            "review": {"reviewBody": "Fits as expected."},
        }
        linked = {
            "@type": "Product",
            "sku": "runner",
            "name": "Road Runner",
            "review": {"@id": "#review"},
        }
        graph = {
            "@graph": [
                product,
                linked,
                {
                    "@id": "#review",
                    "@type": "Review",
                    "reviewBody": "Very comfortable.",
                },
            ]
        }
        pages = {
            "/robots.txt": ("text/plain", "User-agent: *\nDisallow: /private\n"),
            "/listing": ("text/html", '<a class="card" href="/trainer">Trainer</a>'),
            "/trainer": (
                "text/html",
                (
                    "<p>Customer reviews: 5 stars. Best shoes ever.</p>"
                    '<script type="application/ld+json">{</script>'
                    f'<script type="application/ld+json">{json.dumps(graph)}</script>'
                ),
            ),
            "/broken": ("text/html", '<script type="application/ld+json">{</script>'),
        }

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                fetched.append(self.path)
                content_type, body = pages.get(self.path, ("text/plain", "Missing"))
                self.send_response(200 if self.path in pages else 404)
                self.send_header("Content-Type", content_type)
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, format, *args):
                pass

        self.products = [product, linked]
        server = self.enterContext(ThreadingHTTPServer(("127.0.0.1", 0), Handler))
        thread = Thread(target=server.serve_forever)
        thread.start()
        self.addCleanup(thread.join)
        self.addCleanup(server.shutdown)
        self.origin = f"http://127.0.0.1:{server.server_port}"
        self.runner = self.enterContext(asyncio.Runner())

    def test_listing_and_direct_visits_read_inline_products(self):
        for path, selector in [("/listing", "a.card"), ("/trainer", None)]:
            rows, failed = self.runner.run(
                collect_pages([self.origin + path], selector=selector, max_pages=3)
            )
            self.assertEqual(failed, 0)
            self.assertEqual([row.product for row in rows], self.products)
            self.assertEqual(
                [reviews_for(row.product) for row in rows], [("Fits as expected.",), ()]
            )
        self.assertEqual(self.fetched.count("/trainer"), 2)

    def test_empty_listings_and_invalid_markup_report_failure(self):
        for path, selector in [("/listing", ".changed"), ("/broken", None)]:
            with self.subTest(path=path):
                self.assertEqual(
                    self.runner.run(
                        collect_pages([self.origin + path], selector=selector)
                    ),
                    ([], 1),
                )

    def test_robots_exclusion_skips_product_request(self):
        self.assertEqual(
            self.runner.run(collect_pages([self.origin + "/private"])), ([], 1)
        )
        self.assertNotIn("/private", self.fetched)
