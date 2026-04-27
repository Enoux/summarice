import type { CommentedHighlight, ScaledPosition } from '$lib/pdf-highlighter/types';
import { DEFAULT_SLOT_HEX, type CategorySlotId } from './highlight-categories';

export type HighlightRow = {
	id: string;
	document_id: string;
	owner_id: string;
	ordinal: number;
	kind: 'text' | 'area';
	page_number: number;
	text: string | null;
	comment: string | null;
	screenshot_path: string | null;
	bounding_box: ScaledPosition;
	category: number | null;
	color: string;
	created_at: string;
};

export function rowToCommentedHighlight(row: HighlightRow): CommentedHighlight {
	const category = row.category as CategorySlotId | null;
	const colorIndex =
		category != null && category >= 1 && category <= 5 ? category - 1 : 0;

	return {
		id: row.id,
		type: row.kind,
		position: row.bounding_box,
		content:
			row.kind === 'text'
				? { text: row.text ?? '' }
				: row.kind === 'area'
					? {}
					: {},
		comment: row.comment ?? undefined,
		color_index: colorIndex,
		category_slot: category === null ? null : category,
		ordinal: row.ordinal,
		display_color: row.color
	};
}

export function commentedHighlightToCreatePayload(
	h: CommentedHighlight,
	opts: {
		documentId: string;
		/** When false, category comes from color_index + 1 */
		decorative: boolean;
		/** Explicit hex for DB `color` column */
		colorHex: string;
	}
) {
	const kind = h.type ?? 'text';
	const pageNumber = h.position?.boundingRect.pageNumber ?? 1;
	const text = kind === 'text' ? (h.content?.text ?? '') : null;
	const bounding = h.position as ScaledPosition;
	if (!bounding?.boundingRect) {
		throw new Error('Missing bounding box');
	}
	const slot = Math.min(Math.max((h.color_index ?? 0) + 1, 1), 5);
	const category: number | null = opts.decorative ? null : slot;

	return {
		p_document_id: opts.documentId,
		p_kind: kind,
		p_page_number: pageNumber,
		p_text: text,
		p_bounding_box: bounding,
		p_category: category,
		p_color: opts.colorHex,
		p_comment: h.comment ?? null,
		p_screenshot_path: null as string | null
	};
}

export function hexForNewHighlight(
	h: CommentedHighlight,
	opts: { decorative: boolean; decorativeDefaultHex: string; slotHexByIndex: string[] }
): string {
	if (opts.decorative) {
		return h.display_color ?? opts.decorativeDefaultHex;
	}
	const idx = Math.min(Math.max(h.color_index ?? 0, 0), 4);
	return opts.slotHexByIndex[idx] ?? DEFAULT_SLOT_HEX[(idx + 1) as CategorySlotId];
}
