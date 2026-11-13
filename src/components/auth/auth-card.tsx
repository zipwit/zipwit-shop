import type { ReactNode } from "react";
import { Card } from "#/components/ui/card";
import { cn } from "#/lib/utils";

/** Compact, shared frame for the sign-in and registration forms. */
export function AuthCard({
	children,
	className,
	notice,
	title,
}: {
	children: ReactNode;
	className?: string;
	notice?: ReactNode;
	title: string;
}) {
	return (
		<Card className={cn("w-full max-w-md gap-0 p-0", className)}>
			<div className="min-w-0 p-6 sm:p-8">
				{notice}
				<h1 className="type-title mb-6 text-2xl">{title}</h1>
				{children}
			</div>
		</Card>
	);
}
