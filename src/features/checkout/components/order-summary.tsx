import type { ReactNode } from "react";
import { LinkButton } from "#/components/link-button";
import type { CartItem } from "#/features/cart/cart";
import { CartLoadBoundary } from "#/features/cart/components/cart-load-boundary";
import type { useCart } from "#/features/cart/use-cart";
import { ProductImage } from "#/features/catalog/components/product-image";
import { ShipmentDetails } from "#/features/shipping/shipment-details";
import {
	groupShipments,
	type ShipmentQuote,
} from "#/features/shipping/shipping";
import { useTranslation } from "#/i18n/translate";
import { usePriceFormatter } from "#/lib/price";
import type { CheckoutQuote } from "../checkout";

function OrderItems({ items }: { items: CartItem[] }) {
	const { formatPrice } = usePriceFormatter();
	return (
		<ul className="divide-y">
			{items.map((item) => (
				<li
					key={item.id}
					className="flex items-start gap-4 py-5 first:pt-0 last:pb-0"
				>
					<ProductImage
						compact
						src={item.image}
						alt=""
						className="size-16 shrink-0 rounded-md border border-border/60 bg-background"
					/>
					<div className="min-w-0 flex-1 text-sm">
						<p className="wrap-anywhere font-medium leading-relaxed">
							{item.name}
						</p>
						<div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<p className="text-xs text-muted-foreground">
								{item.quantity} × {formatPrice(item.price, item.currency)}
							</p>
							<p className="font-semibold tabular-nums">
								{formatPrice(item.price * item.quantity, item.currency)}
							</p>
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}

function SummaryCard({ children }: { children: ReactNode }) {
	const t = useTranslation();
	return (
		<div className="space-y-6 rounded-lg border border-border/80 bg-card p-5 shadow-premium-sm sm:p-6">
			<h2 className="type-title border-b border-border/70 pb-5 text-xl">
				{t("Order summary")}
			</h2>
			{children}
		</div>
	);
}

function ShipmentItems({
	number,
	items,
	quote,
}: {
	number: number;
	items: CartItem[];
	quote?: ShipmentQuote;
}) {
	return (
		<section className="space-y-5">
			<ShipmentDetails
				className="rounded-md border border-border/60 bg-background/70 p-4"
				number={number}
				items={items}
				quote={quote}
			/>
			<OrderItems items={items} />
		</section>
	);
}

export function OrderSummary({ quote }: { quote: CheckoutQuote }) {
	const items = quote.lines.map((line) => ({
		...line,
		price: line.usdPrice,
		currency: "USD",
	}));
	return (
		<SummaryCard>
			{quote.shipments ? (
				quote.shipments.map((shipment, index) => (
					<ShipmentItems
						key={shipment.groupId}
						number={index + 1}
						items={items.filter((item) => shipment.itemIds.includes(item.id))}
						quote={shipment}
					/>
				))
			) : (
				<OrderItems items={items} />
			)}
			<OrderTotals quote={quote} />
		</SummaryCard>
	);
}

function OrderTotals({ quote }: { quote: CheckoutQuote }) {
	const t = useTranslation();
	const { formatPrice } = usePriceFormatter();
	const usd = (value: number) => formatPrice(value, "USD");
	return (
		<>
			<dl className="space-y-3 border-t pt-4 text-sm [&>div]:flex [&>div]:flex-wrap [&>div]:justify-between [&>div]:gap-x-3 [&>div]:gap-y-1 [&_dd]:font-medium [&_dd]:tabular-nums">
				<div>
					<dt>{t("Items")}</dt>
					<dd>{usd(quote.subtotalUsd)}</dd>
				</div>
				<div>
					<dt>
						{t("Service fee ({{percent}}%)", {
							percent: quote.pricing.serviceFeeBps / 100,
						})}
					</dt>
					<dd>{usd(quote.serviceFeeUsd)}</dd>
				</div>
				<div>
					<dt>{t("U.S. shipping")}</dt>
					<dd className={quote.shippingUsd ? undefined : "text-price"}>
						{quote.shippingUsd ? usd(quote.shippingUsd) : t("Free")}
					</dd>
				</div>
				<div className="border-t pt-4 text-base font-semibold">
					<dt>{t("Total")}</dt>
					<dd className="type-num text-xl">{usd(quote.totalUsd)}</dd>
				</div>
				<div className="text-muted-foreground">
					<dt>{t("Total in lari (GEL)")}</dt>
					<dd>{formatPrice(quote.totalGel, "GEL")}</dd>
				</div>
			</dl>
			<p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
				{t(
					"Service fee applies to items only. Shipping is charged separately for each warehouse.",
				)}
			</p>
		</>
	);
}

export function CartSummary({ cart }: { cart: ReturnType<typeof useCart> }) {
	const t = useTranslation();
	const { formatPrice } = usePriceFormatter();
	return (
		<SummaryCard>
			<CartLoadBoundary cart={cart}>
				{!cart.items.length ? (
					<>
						<p className="text-sm text-muted-foreground">
							{t("Your cart is empty")}
						</p>
						<LinkButton to="/deals" variant="outline">
							{t("All deals")}
						</LinkButton>
					</>
				) : (
					<>
						{groupShipments(cart.items).map((group, index) => (
							<ShipmentItems
								key={group.groupId}
								number={index + 1}
								items={group.lines}
							/>
						))}
						<div className="flex flex-wrap justify-between gap-2 border-t pt-4 font-semibold">
							<span>{t("Subtotal")}</span>
							<span>{formatPrice(cart.subtotal, cart.currency)}</span>
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground">
							{t(
								"Review your final total, including shipping and fees, before you pay.",
							)}
						</p>
					</>
				)}
			</CartLoadBoundary>
		</SummaryCard>
	);
}
