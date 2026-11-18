CREATE TABLE `address` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text NOT NULL,
	`line1` text NOT NULL,
	`line2` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`postal_code` text NOT NULL,
	`country` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_address_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `checkout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quote` text NOT NULL,
	`shipping_address` text NOT NULL,
	`expires_at` integer NOT NULL,
	`cart_id` text,
	`proof_base64` text,
	`proof_type` text,
	`submitted_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_checkout_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `order_cart_cleanup` (
	`order_id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`lines` text NOT NULL,
	`next_attempt_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_order_cart_cleanup_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`sku_id` text,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`color` text,
	`size` text,
	`image_url` text,
	CONSTRAINT `fk_order_item_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT "order_item_quantity_positive" CHECK("quantity" > 0),
	CONSTRAINT "order_item_price_not_negative" CHECK("price" >= 0)
);
--> statement-breakpoint
CREATE TABLE `order_notification` (
	`order_id` text PRIMARY KEY NOT NULL,
	`next_message` integer DEFAULT 0 NOT NULL,
	`proof_sent` integer DEFAULT false NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`lease_until` integer,
	`sent_at` integer,
	CONSTRAINT `fk_order_notification_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` integer NOT NULL,
	`currency` text NOT NULL,
	`checkout_quote` text,
	`customer_name` text,
	`customer_email` text,
	`shipping_address` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_orders_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "orders_status_valid" CHECK("status" in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
	CONSTRAINT "orders_total_positive" CHECK("total" > 0)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `address_user_idx` ON `address` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `address_primary_uq` ON `address` (`user_id`) WHERE "address"."is_primary";--> statement-breakpoint
CREATE INDEX `checkout_session_user_idx` ON `checkout_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `order_cart_cleanup_due_idx` ON `order_cart_cleanup` (`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `order_item_order_idx` ON `order_item` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_notification_due_idx` ON `order_notification` (`next_attempt_at`) WHERE "order_notification"."sent_at" is null;--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);