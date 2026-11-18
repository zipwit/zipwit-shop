import { Button } from "#/components/ui/button";
import { type CartItem, MAX_QUANTITY } from "#/features/cart/cart";
import { useCartLineActions, useCartUpdating } from "#/features/cart/use-cart";
import { ProductImage } from "#/features/catalog/components/product-image";
import { ShipmentDetails } from "#/features/shipping/shipment-details";
import { groupShipments } from "#/features/shipping/shipping";
import { useTranslation } from "#/i18n/translate";
import { usePriceFormatter } from "#/lib/price";

export function CartShipments({
	items,
	onBrowse,
}: {
	items: CartItem[];
	onBrowse: () => void;
}) {
	return (
		<div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 sm:px-6">
			{groupShipments(items).map((group, index) => (
				<section key={group.groupId}>
					<ShipmentDetails
						number={index + 1}
						items={group.lines}
						onBrowse={onBrowse}
					/>
					<CartLines items={group.lines} />
				</section>
			))}
		</div>
	);
}

function CartLines({ items }: { items: CartItem[] }) {
	const { formatPrice } = usePriceFormatter();
	const t = useTranslation();
	const { setQuantity, removeItem } = useCartLineActions();
	const updating = useCartUpdating();

	return (
		<ul aria-busy={updating} className="divide-y">
			{items.map((item) => (
				<li key={item.id} className="flex gap-4 py-6">
					<ProductImage
						compact
						src={item.image}
						alt={item.name}
						className="size-16 shrink-0 rounded-lg sm:size-24"
					/>

					<div className="flex min-w-0 flex-1 flex-col">
						<div className="flex flex-wrap justify-between gap-2">
							<p className="line-clamp-2 text-sm font-medium leading-snug">
								{item.name}
							</p>
							<p className="shrink-0 text-sm font-semibold text-price tabular-nums">
								{formatPrice(item.price * item.quantity, item.currency)}
							</p>
						</div>
						<p className="text-muted-foreground text-sm">
							{t("{{price}} each", {
								price: formatPrice(item.price, item.currency),
							})}
						</p>

						<div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									disabled={updating}
									aria-label={t("Decrease quantity of {{name}}", {
										name: item.name,
									})}
									onClick={() => setQuantity(item.id, item.quantity - 1)}
								>
									−
								</Button>
								<span className="w-6 text-center text-sm">{item.quantity}</span>
								<Button
									variant="outline"
									size="icon"
									aria-label={t("Increase quantity of {{name}}", {
										name: item.name,
									})}
									disabled={updating || item.quantity >= MAX_QUANTITY}
									onClick={() => setQuantity(item.id, item.quantity + 1)}
								>
									+
								</Button>
							</div>
							<Button
								variant="link"
								size="sm"
								type="button"
								disabled={updating}
								className="min-h-10 px-1 text-muted-foreground hover:text-foreground"
								onClick={() => removeItem(item.id)}
							>
								{t("Remove")}
							</Button>
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}
