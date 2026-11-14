import { defineRelations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { account, user } from "#/db/auth-schema";
import type {
	CheckoutAddress,
	CheckoutQuote,
} from "#/features/checkout/checkout";

export * from "./auth-schema";

export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"paid",
	"shipped",
	"delivered",
	"cancelled",
]);

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

const timestamps = {
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

export const orders = pgTable(
	"orders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		status: orderStatusEnum("status").notNull().default("pending"),
		total: integer("total").notNull(),
		currency: text("currency").notNull(),
		// Historical pricing and bank instructions remain immutable after submission.
		checkoutQuote: jsonb("checkout_quote").$type<CheckoutQuote>(),
		customerName: text("customer_name"),
		customerEmail: text("customer_email"),
		shippingAddress: jsonb("shipping_address")
			.$type<ShippingAddress>()
			.notNull(),
		...timestamps,
	},
	(t) => [
		index("orders_user_idx").on(t.userId),
		check("orders_total_positive", sql`${t.total} > 0`),
	],
);

/** Private, server-owned checkout draft. Its UUID becomes the final order ID. */
export const checkoutSession = pgTable(
	"checkout_session",
	{
		id: uuid("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		quote: jsonb("quote").$type<CheckoutQuote>().notNull(),
		shippingAddress: jsonb("shipping_address")
			.$type<CheckoutAddress>()
			.notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		// Kept in the private database, never exposed as a public file URL.
		proofBase64: text("proof_base64"),
		proofType: text("proof_type"),
		submittedAt: timestamp("submitted_at"),
		...timestamps,
	},
	(t) => [index("checkout_session_user_idx").on(t.userId)],
);

/** Transactional notification queue; a worker retries Telegram independently of checkout. */
export const orderNotification = pgTable(
	"order_notification",
	{
		orderId: uuid("order_id")
			.primaryKey()
			.references(() => orders.id, { onDelete: "cascade" }),
		nextMessage: integer("next_message").notNull().default(0),
		proofSent: boolean("proof_sent").notNull().default(false),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
		leaseUntil: timestamp("lease_until"),
		sentAt: timestamp("sent_at"),
	},
	(t) => [
		index("order_notification_due_idx")
			.on(t.nextAttemptAt)
			.where(sql`${t.sentAt} is null`),
	],
);

export const orderItem = pgTable(
	"order_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		// Catalog identity is a snapshot, not a foreign key into the live Redis catalog.
		skuId: uuid("sku_id"),
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
		id: uuid("id").primaryKey().defaultRandom(),
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
		// At most one primary address per user, enforced by the database.
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
