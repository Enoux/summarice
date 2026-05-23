import type { FastSearchClientResult } from '$lib/search/apply-fast-search-client-filters';

export function resolveFastSearchPreviewPage(result: FastSearchClientResult): number {
	if (result.kind === 'document') {
		return 1;
	}
	return result.pageNumber;
}
