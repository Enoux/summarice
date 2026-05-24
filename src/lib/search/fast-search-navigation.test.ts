import { describe, expect, it } from 'vitest';
import {
	extractHighlightIdFromHref,
	type FastSearchNavigationResult,
	isFastSearchOptimisticDocumentLoading,
	resultPathname,
	shouldHandleFastSearchResultLocally,
	uniqueFastSearchPrefetchPathnames
} from './fast-search-navigation';

const highlightResult = (href: string, documentId: string): FastSearchNavigationResult => ({
	kind: 'direct_highlight' as const,
	highlightId: 'highlight-1',
	documentId,
	href
});

describe('fast search navigation helpers', () => {
	it('extracts highlight ids from result href hashes', () => {
		expect(extractHighlightIdFromHref('/doc/doc-1#highlight-highlight-1')).toBe('highlight-1');
		expect(extractHighlightIdFromHref('/doc/doc-1')).toBeNull();
		expect(extractHighlightIdFromHref('/doc/doc-1#section-1')).toBeNull();
	});

	it('handles same-document highlight results locally', () => {
		expect(
			shouldHandleFastSearchResultLocally({
				result: highlightResult('/doc/doc-1#highlight-highlight-1', 'doc-1'),
				currentDocumentId: 'doc-1'
			})
		).toBe(true);
		expect(
			shouldHandleFastSearchResultLocally({
				result: highlightResult('/doc/doc-2#highlight-highlight-1', 'doc-2'),
				currentDocumentId: 'doc-1'
			})
		).toBe(false);
	});

	it('deduplicates visible result pathnames before preloading', () => {
		expect(
			uniqueFastSearchPrefetchPathnames({
				results: [
					highlightResult('/doc/doc-1#highlight-highlight-1', 'doc-1'),
					highlightResult('/doc/doc-1#highlight-highlight-2', 'doc-1'),
					highlightResult('/doc/doc-2#highlight-highlight-3', 'doc-2')
				],
				limit: 2
			})
		).toEqual(['/doc/doc-1', '/doc/doc-2']);
	});

	it('strips hashes from result pathnames', () => {
		expect(resultPathname('/doc/doc-1#highlight-highlight-1')).toBe('/doc/doc-1');
		expect(resultPathname('/doc/doc-1')).toBe('/doc/doc-1');
	});

	it('shows optimistic document loading only while crossing documents', () => {
		expect(
			isFastSearchOptimisticDocumentLoading({
				target: {
					documentId: 'doc-2',
					documentTitle: 'Doc 2',
					href: '/doc/doc-2#highlight-highlight-1',
					highlightId: 'highlight-1'
				},
				currentDocumentId: 'doc-1'
			})
		).toBe(true);
		expect(
			isFastSearchOptimisticDocumentLoading({
				target: {
					documentId: 'doc-1',
					documentTitle: 'Doc 1',
					href: '/doc/doc-1#highlight-highlight-1',
					highlightId: 'highlight-1'
				},
				currentDocumentId: 'doc-1'
			})
		).toBe(false);
		expect(
			isFastSearchOptimisticDocumentLoading({
				target: null,
				currentDocumentId: 'doc-1'
			})
		).toBe(false);
	});
});
