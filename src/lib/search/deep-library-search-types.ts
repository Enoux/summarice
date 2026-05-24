export type DeepLibrarySearchMode = 'fast' | 'deep';

export const DEEP_LIBRARY_SEARCH_MODE_STORAGE_KEY = 'summarice.search.mode';

export type DeepLibrarySearchTargetKind =
	| 'highlight'
	| 'area_highlight'
	| 'note'
	| 'document';

export type DeepLibrarySearchIntent = {
	rewrittenQueries: string[];
	targetKinds: DeepLibrarySearchTargetKind[];
	wantsRecent: boolean;
};

export type DeepLibrarySearchResult = {
	kind: 'highlight' | 'document';
	highlightId: string | null;
	documentId: string;
	documentTitle: string;
	pageNumber: number | null;
	matchedEvidence: string;
	reason: string;
	score: number;
	href: string;
	updatedAt: string | null;
};

export type DeepLibrarySearchStatusPhase =
	| 'interpreting'
	| 'searching'
	| 'reading'
	| 'ranking'
	| 'failed';

export type DeepLibrarySearchStatusStep = {
	phase: DeepLibrarySearchStatusPhase;
	label: string;
	detail: string | null;
};

export type DeepLibrarySearchResponse = {
	prompt: string;
	interpretedIntent: DeepLibrarySearchIntent;
	statusSteps: DeepLibrarySearchStatusStep[];
	results: DeepLibrarySearchResult[];
};
