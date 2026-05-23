import { searchColorFilterValue } from '$lib/highlights/color-slots';
import type {
	FastSearchFilters,
	FastSearchResultScope
} from '$lib/search/fast-search-types';

export type FastSearchClientLaneId = 'direct' | 'summary' | 'semantic' | 'document';

export type FastSearchClientHighlightResult = {
	kind: 'direct_highlight' | 'summary_highlight' | 'semantic_highlight';
	highlightId: string;
	documentId: string;
	documentTitle: string;
	pageNumber: number;
	highlightKind: 'text' | 'area';
	text: string | null;
	comment: string | null;
	annotationPreview: string | null;
	aiAnnotationPreview: string | null;
	color: string;
	href: string;
};

export type FastSearchClientDocumentResult = {
	kind: 'document';
	documentId: string;
	documentTitle: string;
	text: string;
	href: string;
};

export type FastSearchClientResult = FastSearchClientHighlightResult | FastSearchClientDocumentResult;

export type FastSearchClientLane = {
	id: FastSearchClientLaneId;
	label: string;
	results: FastSearchClientResult[];
};

function isHighlightResult(result: FastSearchClientResult): result is FastSearchClientHighlightResult {
	return result.kind !== 'document';
}

function isHighlightLane(laneId: FastSearchClientLaneId): boolean {
	return laneId !== 'document';
}

function matchesColorFilter(
	result: FastSearchClientHighlightResult,
	filterColor: string
): boolean {
	const normalizedFilter = searchColorFilterValue(filterColor).toLowerCase();
	return result.color.toLowerCase() === normalizedFilter;
}

function filterLaneResults(
	lane: FastSearchClientLane,
	filters: FastSearchFilters
): FastSearchClientLane {
	if (!isHighlightLane(lane.id)) {
		return lane;
	}

	if (filters.color === undefined) {
		return lane;
	}

	const results = lane.results.filter(
		(result): result is FastSearchClientHighlightResult =>
			isHighlightResult(result) && matchesColorFilter(result, filters.color as string)
	);

	return { ...lane, results };
}

function applyResultScope(
	lanes: FastSearchClientLane[],
	resultScope: FastSearchResultScope
): FastSearchClientLane[] {
	if (resultScope === 'both') {
		return lanes;
	}

	if (resultScope === 'highlights') {
		return lanes.filter((lane) => isHighlightLane(lane.id));
	}

	return lanes.filter((lane) => lane.id === 'document');
}

export function applyFastSearchClientFilters(
	lanes: FastSearchClientLane[],
	filters: FastSearchFilters,
	resultScope: FastSearchResultScope
): FastSearchClientLane[] {
	const scopedLanes = applyResultScope(lanes, resultScope);
	return scopedLanes.map((lane) => filterLaneResults(lane, filters));
}

export function countFastSearchClientResults(lanes: FastSearchClientLane[]): number {
	return lanes.reduce((total, lane) => total + lane.results.length, 0);
}
