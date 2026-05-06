import type {
	Highlight,
	HighlightAdjustmentDraft,
	HighlightPopupActionState
} from '$lib/pdf-highlighter/types';

export type TipPopupMode =
	| 'hidden'
	| 'new-selection'
	| 'existing-hover'
	| 'existing-edit'
	| 'adjust-highlight'
	| 'confirm-reexplain';

type TipPopupModeArgs = {
	activeHighlight?: Highlight;
	pinned: boolean;
	adjustmentDraft?: HighlightAdjustmentDraft | null;
	actionState?: HighlightPopupActionState;
};

export function getTipPopupMode({
	activeHighlight,
	pinned,
	adjustmentDraft,
	actionState
}: TipPopupModeArgs): TipPopupMode {
	if (!activeHighlight) return 'hidden';
	if (!activeHighlight.id) return 'new-selection';
	if (adjustmentDraft?.highlightId === activeHighlight.id) return 'adjust-highlight';
	if (actionState?.pendingReExplainHighlightId === activeHighlight.id) return 'confirm-reexplain';
	if (!pinned) return 'existing-hover';
	return 'existing-edit';
}
