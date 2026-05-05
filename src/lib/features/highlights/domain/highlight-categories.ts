/** Fixed 5-slot semantic categories (PRD Decision J1). Slot ids are stable for prompts + queries. */

export const CATEGORY_SLOT_IDS = [1, 2, 3, 4, 5] as const;
export type CategorySlotId = (typeof CATEGORY_SLOT_IDS)[number];
export type HighlightColorMode = 'light' | 'dark';

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
	'1': 'Key idea',
	'2': 'Definition',
	'3': 'Evidence',
	'4': 'Question',
	'5': 'Contradiction'
};

/** Default hex colors per slot (Yellow, Green, Blue, Pink, Orange). */
export const LIGHT_HIGHLIGHT_SLOT_HEX: Record<CategorySlotId, string> = {
	1: '#facc15',
	2: '#22c55e',
	3: '#3b82f6',
	4: '#ec4899',
	5: '#f97316'
};
export const DEFAULT_SLOT_HEX = LIGHT_HIGHLIGHT_SLOT_HEX;

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const DARK_CHROMA_FACTOR = 0.82;

export function slotHex(slot: CategorySlotId): string {
	return LIGHT_HIGHLIGHT_SLOT_HEX[slot];
}

export function canonicalHighlightPalette(): string[] {
	return CATEGORY_SLOT_IDS.map((id) => LIGHT_HIGHLIGHT_SLOT_HEX[id]);
}

export function resolveHighlightPalette(mode: HighlightColorMode): string[] {
	return canonicalHighlightPalette().map((color) => resolveHighlightColor(color, mode));
}

export function resolveHighlightColor(color: string, mode: HighlightColorMode): string {
	if (mode === 'light') return color;
	if (!HEX_COLOR_RE.test(color)) return color;

	const rgb = hexToRgb(color);
	if (!rgb) return color;

	const { L, a, b } = rgbToOklab(rgb);
	const chroma = Math.sqrt(a * a + b * b);
	if (!Number.isFinite(chroma)) return color;

	const hue = Math.atan2(b, a);
	return rgbToHex(
		oklabToRgb({
			L,
			a: Math.cos(hue) * chroma * DARK_CHROMA_FACTOR,
			b: Math.sin(hue) * chroma * DARK_CHROMA_FACTOR
		})
	);
}

export function parseCategoryLabels(raw: unknown): Record<string, string> {
	if (!raw || typeof raw !== 'object') return { ...DEFAULT_CATEGORY_LABELS };
	const o = raw as Record<string, unknown>;
	const out: Record<string, string> = { ...DEFAULT_CATEGORY_LABELS };
	for (const id of CATEGORY_SLOT_IDS) {
		const v = o[String(id)];
		if (typeof v === 'string' && v.trim()) out[String(id)] = v.trim();
	}
	return out;
}

export function paletteFromSettings(
	labels: Record<string, string>,
	decorative: boolean
): { labels: string[]; hex: string[] } {
	const hex = canonicalHighlightPalette();
	const lbls = CATEGORY_SLOT_IDS.map((id) => labels[String(id)] ?? DEFAULT_CATEGORY_LABELS[String(id)]);
	if (decorative) {
		return { labels: lbls, hex };
	}
	return { labels: lbls, hex };
}

function hexToRgb(hex: string): [number, number, number] | null {
	const normalized = hex.trim().toLowerCase();
	if (!HEX_COLOR_RE.test(normalized)) return null;
	return [
		Number.parseInt(normalized.slice(1, 3), 16),
		Number.parseInt(normalized.slice(3, 5), 16),
		Number.parseInt(normalized.slice(5, 7), 16)
	];
}

function rgbToHex(rgb: [number, number, number]): string {
	return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function srgbToLinear(channel: number): number {
	const normalized = channel / 255;
	return normalized <= 0.04045
		? normalized / 12.92
		: ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
	const normalized =
		channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
	return Math.round(Math.max(0, Math.min(1, normalized)) * 255);
}

function rgbToOklab([r, g, b]: [number, number, number]) {
	const lr = srgbToLinear(r);
	const lg = srgbToLinear(g);
	const lb = srgbToLinear(b);

	const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
	const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
	const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

	const lCbrt = Math.cbrt(l);
	const mCbrt = Math.cbrt(m);
	const sCbrt = Math.cbrt(s);

	return {
		L: 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt,
		a: 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt,
		b: 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt
	};
}

function oklabToRgb(oklab: { L: number; a: number; b: number }): [number, number, number] {
	const l = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
	const m = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
	const s = oklab.L - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

	const l3 = l ** 3;
	const m3 = m ** 3;
	const s3 = s ** 3;

	const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
	const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
	const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

	return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}
