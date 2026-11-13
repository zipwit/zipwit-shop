import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "#/i18n/translate";
import { useCartDrawerOpen } from "../cart-drawer.store";

const CartDrawer = lazy(() =>
	import("./cart-drawer").then((module) => ({ default: module.CartDrawer })),
);

/** Load on first intent, then retain the drawer for focus restoration and exit animation. */
export function CartDrawerLoader() {
	const open = useCartDrawerOpen();
	const [opened, setOpened] = useState(false);
	const t = useTranslation();
	useEffect(() => {
		if (open) setOpened(true);
	}, [open]);
	if (!open && !opened) return null;
	return (
		<Suspense
			fallback={
				open ? (
					<p
						role="status"
						className="fixed right-5 bottom-5 z-50 rounded-lg border bg-card p-5 shadow-premium"
					>
						{t("Loading your cart…")}
					</p>
				) : null
			}
		>
			<CartDrawer />
		</Suspense>
	);
}
