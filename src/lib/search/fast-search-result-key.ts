import type { FastSearchClientResult } from '$lib/search/apply-fast-search-client-filters';

export function fastSearchResultKey(result: FastSearchClientResult): string {
	if (result.kind === 'document') {
		return `document:${result.documentId}`;
	}
	return `highlight:${result.highlightId}:${result.kind}`;
}
