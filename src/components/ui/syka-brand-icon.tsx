import "./syka-brand-icon.css";

/** Approved Recorder ribbon mark; same footprint as the previous brand orb. */
export function SykaBrandIcon() {
	return (
		<img
			src={`${import.meta.env.BASE_URL}app-icons/syka-recorder-128.png`}
			width={28}
			height={28}
			className="syka-brand-icon size-7 shrink-0 object-contain"
			alt=""
			aria-hidden="true"
			draggable={false}
			data-syka-brand="recorder"
		/>
	);
}
