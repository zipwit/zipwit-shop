CREATE TABLE "address" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_feed" (
	"id" text PRIMARY KEY,
	"revision" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"quote" jsonb NOT NULL,
	"supplier_pages" jsonb,
	"shipping_address" jsonb NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"cart_id" text,
	"proof_base64" text,
	"proof_type" text,
	"submitted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_source" (
	"sku_id" text PRIMARY KEY,
	"product_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"observed_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_cart_cleanup" (
	"order_id" text PRIMARY KEY,
	"cart_id" text NOT NULL,
	"lines" jsonb NOT NULL,
	"next_attempt_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY,
	"order_id" text NOT NULL,
	"sku_id" text,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"color" text,
	"size" text,
	"image_url" text,
	CONSTRAINT "order_item_quantity_positive" CHECK ("quantity" > 0),
	CONSTRAINT "order_item_price_not_negative" CHECK ("price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_notification" (
	"order_id" text PRIMARY KEY,
	"next_message" integer DEFAULT 0 NOT NULL,
	"proof_sent" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp(3) with time zone,
	"sent_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total" integer NOT NULL,
	"currency" text NOT NULL,
	"checkout_quote" jsonb,
	"customer_name" text,
	"customer_email" text,
	"shipping_address" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_valid" CHECK ("status" in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
	CONSTRAINT "orders_total_positive" CHECK ("total" > 0)
);
--> statement-breakpoint
CREATE TABLE "review_verdict" (
	"key" text PRIMARY KEY,
	"verdict" jsonb NOT NULL,
	"checked_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_shipping_rule" (
	"warehouse" text PRIMARY KEY,
	"flat_rate_usd" integer NOT NULL,
	"free_from_usd" integer,
	CONSTRAINT "shipping_rate_range" CHECK ("flat_rate_usd" between 0 and 100000),
	CONSTRAINT "shipping_threshold_range" CHECK ("free_from_usd" between 0 and 2000000000)
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp(3) with time zone,
	"refresh_token_expires_at" timestamp(3) with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "address_user_idx" ON "address" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "address_primary_uq" ON "address" ("user_id") WHERE "is_primary";--> statement-breakpoint
CREATE INDEX "checkout_session_user_idx" ON "checkout_session" ("user_id");--> statement-breakpoint
CREATE INDEX "deal_source_product_idx" ON "deal_source" ("product_id");--> statement-breakpoint
CREATE INDEX "order_cart_cleanup_due_idx" ON "order_cart_cleanup" ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" ("order_id");--> statement-breakpoint
CREATE INDEX "order_notification_due_idx" ON "order_notification" ("next_attempt_at") WHERE "sent_at" is null;--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" ("user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checkout_session" ADD CONSTRAINT "checkout_session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "order_cart_cleanup" ADD CONSTRAINT "order_cart_cleanup_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_notification" ADD CONSTRAINT "order_notification_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;