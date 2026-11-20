import type { ReactNode } from "react";
import { Eyebrow } from "./eyebrow";

/** Shares heading hierarchy and spacing across catalog pages. */
export function PageHeader({
	title,
	eyebrow,
	description,
	children,
}: {
	title: string;
	eyebrow?: string;
	description?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<header className="space-y-4">
			{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
			<h1 className="type-title text-3xl md:text-5xl">{title}</h1>
			{description && (
				<p className="type-body max-w-2xl text-sm text-muted-foreground sm:text-base">
					{description}
				</p>
			)}
			{children}
		</header>
	);
}
