/** Fixed 5-slot semantic categories (PRD Decision J1). Slot ids are stable for prompts + queries. */

export const CATEGORY_SLOT_IDS = [1, 2, 3, 4, 5] as const;
export type CategorySlotId = (typeof CATEGORY_SLOT_IDS)[number];

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
	'1': 'Key idea',
	'2': 'Definition',
	'3': 'Evidence',
	'4': 'Question',
	'5': 'Contradiction'
};

/** Default hex colors per slot (Yellow, Green, Blue, Pink, Orange). */
export const DEFAULT_SLOT_HEX: Record<CategorySlotId, string> = {
	1: '#facc15',
	2: '#22c55e',
	3: '#3b82f6',
	4: '#ec4899',
	5: '#f97316'
};

export function slotHex(slot: CategorySlotId): string {
	return DEFAULT_SLOT_HEX[slot];
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
	const hex = CATEGORY_SLOT_IDS.map((id) => DEFAULT_SLOT_HEX[id]);
	const lbls = CATEGORY_SLOT_IDS.map((id) => labels[String(id)] ?? DEFAULT_CATEGORY_LABELS[String(id)]);
	if (decorative) {
		return { labels: lbls, hex };
	}
	return { labels: lbls, hex };
}
