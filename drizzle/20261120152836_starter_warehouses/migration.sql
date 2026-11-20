-- ShopWSS starts with a direct product page whose size-level prices and stock are available.
-- Enable the other collections after validating their sources.
INSERT INTO catalog_feed (id, revision, enabled, config) VALUES
('a8d035f4-66a9-5817-bd83-dd555e8c770c', 1, true, '{"warehouse": "www.shopwss.com", "department": "men", "category": "shoes", "urls": ["https://www.shopwss.com/products/100283962-reebok-zig-dynamica-6-mens-black-red"], "product_link_selector": null, "max_pages": 50, "rules": {"min_discount_percent": 30, "max_age_minutes": 60}}'::jsonb),
('c2caa296-38cf-5f4e-bf82-e5e549ee373e', 1, false, '{"warehouse": "www.shoepalace.com", "department": "men", "category": "shoes", "urls": ["https://www.shoepalace.com/collections/mens-sale-shoes"], "product_link_selector": "main a[href*=''/products/'']", "max_pages": 50, "rules": {"min_discount_percent": 30, "max_age_minutes": 60}}'::jsonb),
('222c6e06-1162-554f-bde7-8f96534609dd', 1, false, '{"warehouse": "www.joesnewbalanceoutlet.com", "department": "men", "category": "shoes", "urls": ["https://www.joesnewbalanceoutlet.com/men/shoes/all-shoes/"], "product_link_selector": "main a[href*=''/pd/'']", "max_pages": 50, "rules": {"min_discount_percent": 30, "max_age_minutes": 60}}'::jsonb)
ON CONFLICT (id) DO NOTHING;
