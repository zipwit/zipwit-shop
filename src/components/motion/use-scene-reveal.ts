import { useReducedMotion } from "motion/react";

export const sceneEase = [0.22, 1, 0.36, 1] as const;

/** Keep server-rendered content visible; animate only when it enters the viewport. */
export function useSceneReveal(delay = 0) {
	const reduced = useReducedMotion();
	return {
		initial: false as const,
		whileInView: reduced
			? { opacity: 1, y: 0 }
			: { opacity: [0.45, 1], y: [24, 0] },
		viewport: { once: true, amount: 0.12 },
		transition: {
			type: "tween" as const,
			duration: reduced ? 0 : 0.8,
			delay: reduced ? 0 : delay,
			ease: sceneEase,
		},
	};
}
