import { type RefObject, useEffect, useState } from "react";

/** Whether the scroller can still move left / right, kept in sync with its scroll. */
export function useScrollEdges(
	ref: RefObject<HTMLElement | null>,
	itemCount: number,
) {
	const [edges, setEdges] = useState({ atStart: true, atEnd: true });

	useEffect(() => {
		const el = ref.current;
		if (!el || !itemCount) return;

		const update = () => {
			const atStart = el.scrollLeft <= 1;
			const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
			setEdges((previous) =>
				previous.atStart === atStart && previous.atEnd === atEnd
					? previous
					: { atStart, atEnd },
			);
		};

		update();
		el.addEventListener("scroll", update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(el);

		return () => {
			el.removeEventListener("scroll", update);
			observer.disconnect();
		};
	}, [ref, itemCount]);

	return edges;
}
