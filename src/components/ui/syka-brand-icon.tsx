import { motion, useReducedMotion } from "motion/react";

/** Approved Recorder ribbon mark; same footprint as the previous brand orb. */
export function SykaBrandIcon() {
	const reducedMotion = useReducedMotion();
	return (
		<motion.img
			src={`${import.meta.env.BASE_URL}app-icons/syka-recorder-128.png`}
			width={28}
			height={28}
			className="size-7 shrink-0 object-contain"
			alt=""
			aria-hidden="true"
			draggable={false}
			data-syka-brand="recorder"
			animate={{ scale: reducedMotion ? 1 : [1, 1.035, 1] }}
			transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
		/>
	);
}
