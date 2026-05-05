export interface HighlightSelectionState {
	selectedHighlightId: string | null;
	sidebarOpen: boolean;
}

export function applyHighlightSelection(
	_state: HighlightSelectionState,
	highlightId: string
): HighlightSelectionState {
	return {
		selectedHighlightId: highlightId,
		sidebarOpen: true
	};
}
