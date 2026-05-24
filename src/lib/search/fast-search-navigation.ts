export type FastSearchNavigationResult = {
	kind: string;
	documentId: string;
	highlightId?: string;
	href: string;
};

export type FastSearchLocalNavigationInput = {
	result: FastSearchNavigationResult;
	currentDocumentId: string | null;
};

export type FastSearchPrefetchInput = {
	results: FastSearchNavigationResult[];
	limit: number;
};

export type FastSearchOptimisticDocumentLoadingInput = {
	target: ({ documentId: string } & Record<string, unknown>) | null;
	currentDocumentId: string | null;
};

const HIGHLIGHT_HASH_PREFIX = '#highlight-';

export function resultPathname(href: string): string {
	const hashIndex: number = href.indexOf('#');
	return hashIndex >= 0 ? href.slice(0, hashIndex) : href;
}

export function extractHighlightIdFromHref(href: string): string | null {
	const hashIndex: number = href.indexOf(HIGHLIGHT_HASH_PREFIX);
	if (hashIndex < 0) {
		return null;
	}

	const id: string = href.slice(hashIndex + HIGHLIGHT_HASH_PREFIX.length);
	return id.length > 0 ? decodeURIComponent(id) : null;
}

export function shouldHandleFastSearchResultLocally({
	result,
	currentDocumentId
}: FastSearchLocalNavigationInput): boolean {
	return (
		currentDocumentId !== null &&
		result.documentId === currentDocumentId &&
		extractHighlightIdFromHref(result.href) !== null
	);
}

export function uniqueFastSearchPrefetchPathnames({
	results,
	limit
}: FastSearchPrefetchInput): string[] {
	const pathnames: string[] = [];
	const seen = new Set<string>();

	for (const result of results) {
		const pathname: string = resultPathname(result.href);
		if (seen.has(pathname)) {
			continue;
		}
		seen.add(pathname);
		pathnames.push(pathname);
		if (pathnames.length >= limit) {
			return pathnames;
		}
	}

	return pathnames;
}

export function isFastSearchOptimisticDocumentLoading({
	target,
	currentDocumentId
}: FastSearchOptimisticDocumentLoadingInput): boolean {
	return target !== null && target.documentId !== currentDocumentId;
}
