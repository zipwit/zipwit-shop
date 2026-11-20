import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

/** The compact brand label used for discounts and the hero's "up to" claim. */
export function SkewTag({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"discount-ticket inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold tabular-nums",
				className,
			)}
		>
			<span className="inline-block">{children}</span>
		</span>
	);
}
