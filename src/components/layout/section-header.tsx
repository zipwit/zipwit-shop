import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useSceneReveal } from "#/components/motion/use-scene-reveal";
import { cn } from "#/lib/utils";
import { Eyebrow } from "./eyebrow";

type SectionHeaderProps = {
	title: ReactNode;
	eyebrow?: string;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
};

/** Shared heading rhythm for homepage and content sections. */
export function SectionHeader({
	title,
	eyebrow,
	description,
	action,
	className,
}: SectionHeaderProps) {
	const reveal = useSceneReveal();
	return (
		<motion.div
			{...reveal}
			className={cn(
				"flex flex-wrap items-end justify-between gap-4",
				className,
			)}
		>
			<div className="max-w-2xl">
				{eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
				<h2 className="type-title text-[clamp(1.875rem,3.2vw,2.75rem)]">
					{title}
				</h2>
				{description && (
					<p className="type-body mt-3 max-w-xl text-base text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			{action}
		</motion.div>
	);
}
