import { defineRelations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { account, user } from "#/db/auth-schema";
import type { CatalogFeed } from "#/features/admin/catalog-feed";
import type {
	CheckoutAddress,
	CheckoutQuote,
} from "#/features/checkout/checkout";
import { dueAt, timestamp, timestamps } from "./columns";

export * from "./auth-schema";

export const catalogFeed = pgTable("catalog_feed", {
	id: text("id").primaryKey(),
	revision: integer("revision").notNull(),
	enabled: boolean("enabled").notNull(),
	config: jsonb("config").$type<CatalogFeed>().notNull(),
});

export const warehouseShippingRule = pgTable(
	"warehouse_shipping_rule",
	{
		warehouse: text("warehouse").primaryKey(),
		flatRateUsd: integer("flat_rate_usd").notNull(),
		freeFromUsd: integer("free_from_usd"),
	},
	(t) => [
		check("shipping_rate_range", sql`${t.flatRateUsd} between 0 and 100000`),
		check(
			"shipping_threshold_range",
			sql`${t.freeFromUsd} between 0 and 2000000000`,
		),
	],
);

export const dealSource = pgTable(
	"deal_source",
	{
		skuId: text("sku_id").primaryKey(),
		productId: text("product_id").notNull(),
		scopes: text("scopes").array().notNull(),
		observedAt: timestamp("observed_at").notNull(),
	},
	(t) => [index("deal_source_product_idx").on(t.productId)],
);

export const reviewVerdict = pgTable("review_verdict", {
	key: text("key").primaryKey(),
	verdict: jsonb("verdict").notNull(),
	checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

const orderStatuses = [
	"pending",
	"paid",
	"shipped",
	"delivered",
	"cancelled",
] as const;

export type ShippingAddress = {
	fullName: string;
	phone: string;
	line1: string;
	line2?: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
};

/** Orders retain the pricing and bank instructions shown at submission. */
export const orders = pgTable(
	"orders",
	{
		id: text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		status: text("status", { enum: orderStatuses })
			.notNull()
			.default("pending"),
		total: integer("total").notNull(),
		currency: text("currency").notNull(),
		checkoutQuote: jsonb("checkout_quote").$type<CheckoutQuote>(),
		customerName: text("customer_name"),
		customerEmail: text("customer_email"),
		shippingAddress: jsonb("shipping_address")
			.$type<ShippingAddress>()
			.notNull(),
		...timestamps,
	},
	(t) => [
		check(
			"orders_status_valid",
			sql`${t.status} in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')`,
		),
		index("orders_user_idx").on(t.userId),
		check("orders_total_positive", sql`${t.total} > 0`),
	],
);

/** Stores checkout drafts and payment evidence privately. The draft UUID becomes the order ID. */
export const checkoutSession = pgTable(
	"checkout_session",
	{
		id: text("id").notNull().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		quote: jsonb("quote").$type<CheckoutQuote>().notNull(),
		/** Private retailer URLs by SKU for manual fulfillment after catalog withdrawal. */
		supplierPages: jsonb("supplier_pages").$type<Record<string, string>>(),
		shippingAddress: jsonb("shipping_address")
			.$type<CheckoutAddress>()
			.notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		cartId: text("cart_id"),
		proofBase64: text("proof_base64"),
		proofType: text("proof_type"),
		submittedAt: timestamp("submitted_at"),
		...timestamps,
	},
	(t) => [index("checkout_session_user_idx").on(t.userId)],
);

export const orderCartCleanup = pgTable(
	"order_cart_cleanup",
	{
		orderId: text("order_id")
			.notNull()
			.primaryKey()
			.references(() => orders.id, { onDelete: "cascade" }),
		cartId: text("cart_id").notNull(),
		lines: jsonb("lines").$type<{ id: string; quantity: number }[]>().notNull(),
		nextAttemptAt: dueAt(),
	},
	(t) => [index("order_cart_cleanup_due_idx").on(t.nextAttemptAt)],
);

/** Transactional notification queue; a worker retries Telegram independently of checkout. */
export const orderNotification = pgTable(
	"order_notification",
	{
		orderId: text("order_id")
			.notNull()
			.primaryKey()
			.references(() => orders.id, { onDelete: "cascade" }),
		nextMessage: integer("next_message").notNull().default(0),
		proofSent: boolean("proof_sent").notNull().default(false),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: dueAt(),
		leaseUntil: timestamp("lease_until"),
		sentAt: timestamp("sent_at"),
	},
	(t) => [
		index("order_notification_due_idx")
			.on(t.nextAttemptAt)
			.where(sql`${t.sentAt} is null`),
	],
);

/** Stores purchased SKU snapshots independently of the live catalog. */
export const orderItem = pgTable(
	"order_item",
	{
		id: text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		orderId: text("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		skuId: text("sku_id"),
		name: text("name").notNull(),
		price: integer("price").notNull(),
		quantity: integer("quantity").notNull().default(1),
		color: text("color"),
		size: text("size"),
		imageUrl: text("image_url"),
	},
	(t) => [
		index("order_item_order_idx").on(t.orderId),
		check("order_item_quantity_positive", sql`${t.quantity} > 0`),
		check("order_item_price_not_negative", sql`${t.price} >= 0`),
	],
);

export const address = pgTable(
	"address",
	{
		id: text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		fullName: text("full_name").notNull(),
		phone: text("phone").notNull(),
		line1: text("line1").notNull(),
		line2: text("line2"),
		city: text("city").notNull(),
		state: text("state").notNull(),
		postalCode: text("postal_code").notNull(),
		country: text("country").notNull(),
		isPrimary: boolean("is_primary").notNull().default(false),
		...timestamps,
	},
	(t) => [
		index("address_user_idx").on(t.userId),
		uniqueIndex("address_primary_uq").on(t.userId).where(sql`${t.isPrimary}`),
	],
);

export const relations = defineRelations(
	{ user, account, orders, orderItem, address },
	(r) => ({
		user: {
			accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
			orders: r.many.orders({ from: r.user.id, to: r.orders.userId }),
			addresses: r.many.address({ from: r.user.id, to: r.address.userId }),
		},
		address: {
			user: r.one.user({ from: r.address.userId, to: r.user.id }),
		},
		account: {
			user: r.one.user({ from: r.account.userId, to: r.user.id }),
		},
		orders: {
			user: r.one.user({ from: r.orders.userId, to: r.user.id }),
			items: r.many.orderItem({ from: r.orders.id, to: r.orderItem.orderId }),
		},
		orderItem: {
			order: r.one.orders({ from: r.orderItem.orderId, to: r.orders.id }),
		},
	}),
);
