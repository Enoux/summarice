import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
import type { HighlightsModel } from '$lib/pdf-highlighter';

export type PersistedHighlightResponse = CommentedHighlight & {
	text_status: 'refined' | 'fallback';
};

export function buildOptimisticHighlight(
	highlight: CommentedHighlight,
	opts: {
		id: string;
		ordinal: number;
		decorative: boolean;
		colorHex: string;
	}
): CommentedHighlight {
	const categorySlot = opts.decorative
		? null
		: Math.min(Math.max((highlight.color_index ?? 0) + 1, 1), 5);

	return {
		...highlight,
		id: opts.id,
		ordinal: opts.ordinal,
		display_color: opts.colorHex,
		category_slot: categorySlot,
		annotations: highlight.annotations ?? [],
		text_status: 'provisional'
	};
}

export function applyPersistedHighlight(
	store: HighlightsModel<CommentedHighlight>,
	highlight: PersistedHighlightResponse
) {
	if (!highlight.id) return;
	store.editHighlight(highlight.id, highlight);
}
