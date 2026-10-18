/** A sampled value of one animated property, at block-local frame `frame`. */
export interface ChannelPoint {
	frame: number;
	value: number;
}

/** A keyframe and the easing into the next one (null = linear, as in Syka). */
export interface FittedKeyframe {
	frame: number;
	value: number;
	easing: string | null;
}

type BezierParams = [x1: number, y1: number, x2: number, y2: number];

const LINEAR: BezierParams = [1 / 3, 1 / 3, 2 / 3, 2 / 3];
const SEEDS: BezierParams[] = [
	LINEAR,
	[0.42, 0, 0.58, 1],
	[0, 0, 0.58, 1],
	[0.42, 0, 1, 1],
	[0.16, 1, 0.3, 1],
	[0.7, 0, 0.84, 0],
];

/** CSS `cubic-bezier()` timing function, the curve Syka's `cubicBezier(...)` easing evaluates. */
export function evaluateCubicBezier([x1, y1, x2, y2]: BezierParams, progress: number): number {
	if (progress <= 0) return 0;
	if (progress >= 1) return 1;
	const bx = (s: number) => ((1 - 3 * x2 + 3 * x1) * s + (3 * x2 - 6 * x1)) * s * s + 3 * x1 * s;
	const by = (s: number) => ((1 - 3 * y2 + 3 * y1) * s + (3 * y2 - 6 * y1)) * s * s + 3 * y1 * s;
	const dx = (s: number) =>
		3 * (1 - 3 * x2 + 3 * x1) * s * s + 2 * (3 * x2 - 6 * x1) * s + 3 * x1;

	let s = progress;
	for (let i = 0; i < 8; i++) {
		const error = bx(s) - progress;
		if (Math.abs(error) < 1e-7) return by(s);
		const slope = dx(s);
		if (Math.abs(slope) < 1e-6) break;
		s -= error / slope;
	}
	let low = 0;
	let high = 1;
	s = progress;
	for (let i = 0; i < 40; i++) {
		const x = bx(s);
		if (Math.abs(x - progress) < 1e-7) break;
		if (x < progress) low = s;
		else high = s;
		s = (low + high) / 2;
	}
	return by(s);
}

function clampParams([x1, y1, x2, y2]: BezierParams): BezierParams {
	const clampX = (value: number) => Math.min(1, Math.max(0, value));
	const clampY = (value: number) => Math.min(2, Math.max(-1, value));
	return [clampX(x1), clampY(y1), clampX(x2), clampY(y2)];
}

function sumSquaredError(params: BezierParams, points: Array<[number, number]>): number {
	let total = 0;
	for (const [u, w] of points) {
		const diff = evaluateCubicBezier(params, u) - w;
		total += diff * diff;
	}
	return total;
}

/** Nelder–Mead over the four control values, from the best of a few CSS-like seeds. */
function fitBezier(points: Array<[number, number]>): BezierParams {
	const score = (params: BezierParams) => sumSquaredError(clampParams(params), points);
	let start = SEEDS[0];
	let startScore = score(start);
	for (const seed of SEEDS.slice(1)) {
		const seedScore = score(seed);
		if (seedScore < startScore) {
			start = seed;
			startScore = seedScore;
		}
	}

	let simplex: Array<{ params: BezierParams; score: number }> = [
		{ params: start, score: startScore },
	];
	for (let axis = 0; axis < 4; axis++) {
		const params = [...start] as BezierParams;
		params[axis] += 0.15;
		simplex.push({ params, score: score(params) });
	}

	for (let iteration = 0; iteration < 400; iteration++) {
		simplex.sort((left, right) => left.score - right.score);
		if (simplex[4].score - simplex[0].score < 1e-12) break;
		const centroid = [0, 1, 2, 3].map(
			(axis) => simplex.slice(0, 4).reduce((sum, vertex) => sum + vertex.params[axis], 0) / 4,
		) as BezierParams;
		const worst = simplex[4];
		const along = (factor: number) =>
			centroid.map(
				(value, axis) => value + factor * (value - worst.params[axis]),
			) as BezierParams;

		const reflected = along(1);
		const reflectedScore = score(reflected);
		if (reflectedScore < simplex[0].score) {
			const expanded = along(2);
			const expandedScore = score(expanded);
			simplex[4] =
				expandedScore < reflectedScore
					? { params: expanded, score: expandedScore }
					: { params: reflected, score: reflectedScore };
		} else if (reflectedScore < simplex[3].score) {
			simplex[4] = { params: reflected, score: reflectedScore };
		} else {
			const contracted = along(-0.5);
			const contractedScore = score(contracted);
			if (contractedScore < worst.score) {
				simplex[4] = { params: contracted, score: contractedScore };
			} else {
				const best = simplex[0].params;
				simplex = simplex.map((vertex, index) => {
					if (index === 0) return vertex;
					const params = vertex.params.map(
						(value, axis) => best[axis] + 0.5 * (value - best[axis]),
					) as BezierParams;
					return { params, score: score(params) };
				});
			}
		}
	}

	simplex.sort((left, right) => left.score - right.score);
	return clampParams(simplex[0].params);
}

function formatNumber(value: number, digits: number): string {
	const fixed = value.toFixed(digits);
	const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
	return trimmed === "-0" ? "0" : trimmed;
}

/** Syka's parser accepts `cubicBezier(x1,y1,x2,y2)` with plain decimals and no spaces. */
export function formatCubicBezier(params: BezierParams): string {
	return `cubicBezier(${params.map((value) => formatNumber(value, 4)).join(",")})`;
}

/**
 * Reduces a densely sampled channel to keyframes whose eased segments stay
 * within `tolerance` of every sample. Segments that cannot be matched by one
 * cubic-bezier curve are split at their worst sample.
 */
export function fitChannel(points: ChannelPoint[], tolerance: number): FittedKeyframe[] {
	if (
		!Number.isFinite(tolerance) ||
		tolerance <= 0 ||
		points.some(
			(point, index) =>
				!Number.isFinite(point.frame) ||
				!Number.isFinite(point.value) ||
				(index > 0 && point.frame <= points[index - 1].frame),
		)
	) {
		throw new Error("Expected finite, strictly increasing samples and a positive tolerance");
	}
	if (points.length === 0) return [];
	if (points.length === 1) return [{ ...points[0], easing: null }];

	const keyframes: FittedKeyframe[] = [];

	const fitSegment = (startIndex: number, endIndex: number) => {
		const first = points[startIndex];
		const last = points[endIndex];
		const span = last.value - first.value;

		let flatError = 0;
		let flatIndex = startIndex;
		for (let index = startIndex; index <= endIndex; index++) {
			const deviation = Math.abs(points[index].value - first.value);
			if (deviation > flatError) {
				flatError = deviation;
				flatIndex = index;
			}
		}
		let linearError = 0;
		for (let index = startIndex; index <= endIndex; index++) {
			const point = points[index];
			linearError = Math.max(
				linearError,
				Math.abs(
					first.value +
						(span * (point.frame - first.frame)) / (last.frame - first.frame) -
						point.value,
				),
			);
		}
		if (linearError <= tolerance) {
			keyframes.push({ frame: first.frame, value: first.value, easing: null });
			return;
		}
		if (endIndex - startIndex < 2) {
			keyframes.push({ frame: first.frame, value: first.value, easing: null });
			return;
		}
		if (Math.abs(span) <= tolerance) {
			const split = Math.min(endIndex - 1, Math.max(startIndex + 1, flatIndex));
			fitSegment(startIndex, split);
			fitSegment(split, endIndex);
			return;
		}

		const frameSpan = last.frame - first.frame;
		const normalized: Array<[number, number]> = [];
		for (let index = startIndex; index <= endIndex; index++) {
			normalized.push([
				(points[index].frame - first.frame) / frameSpan,
				(points[index].value - first.value) / span,
			]);
		}
		// Validate the serialized curve, not its higher-precision working values.
		const easing = formatCubicBezier(fitBezier(normalized));
		const params = parseCubicBezier(easing);

		let worstError = 0;
		let worstIndex = startIndex;
		for (let index = startIndex; index <= endIndex; index++) {
			const progress = (points[index].frame - first.frame) / frameSpan;
			const predicted = first.value + evaluateCubicBezier(params, progress) * span;
			const error = Math.abs(predicted - points[index].value);
			if (error > worstError) {
				worstError = error;
				worstIndex = index;
			}
		}

		if (worstError <= tolerance) {
			keyframes.push({
				frame: first.frame,
				value: first.value,
				easing,
			});
			return;
		}

		const split = Math.min(endIndex - 1, Math.max(startIndex + 1, worstIndex));
		fitSegment(startIndex, split);
		fitSegment(split, endIndex);
	};

	fitSegment(0, points.length - 1);
	const lastPoint = points[points.length - 1];
	keyframes.push({ frame: lastPoint.frame, value: lastPoint.value, easing: null });

	return keyframes;
}

/** Value of fitted keyframes at `frame`, interpolated the way Syka's motion system does. */
export function evaluateKeyframes(keyframes: FittedKeyframe[], frame: number): number {
	if (keyframes.length === 0) return 0;
	if (frame <= keyframes[0].frame) return keyframes[0].value;
	for (let index = 0; index < keyframes.length - 1; index++) {
		const current = keyframes[index];
		const next = keyframes[index + 1];
		if (frame <= next.frame) {
			const progress = (frame - current.frame) / Math.max(1e-9, next.frame - current.frame);
			const eased = current.easing
				? evaluateCubicBezier(parseCubicBezier(current.easing), progress)
				: progress;
			return current.value + (next.value - current.value) * eased;
		}
	}
	return keyframes[keyframes.length - 1].value;
}

export function parseCubicBezier(easing: string): BezierParams {
	const match = easing.match(/^cubicBezier\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)$/);
	if (!match) throw new Error(`Not a cubicBezier easing: ${easing}`);
	return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}
