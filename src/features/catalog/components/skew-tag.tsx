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
				"inline-flex rounded-full bg-brand-accent/90 px-3 py-1.5 text-xs font-bold text-[#1e293b] shadow-brand",
				className,
			)}
		>
			<span className="inline-block">{children}</span>
		</span>
	);
}
