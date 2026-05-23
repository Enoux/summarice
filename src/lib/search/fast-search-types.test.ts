import { describe, expect, it } from 'vitest';
import {
	FastSearchQueryError,
	readFastSearchFiltersFromJson,
	readFastSearchResultScopeFromJson,
	resolveFastSearchQuery,
	validatePageFilter
} from '$lib/search/fast-search-types';

describe('resolveFastSearchQuery', () => {
	it('keeps bare text and structured filters separate', () => {
		const parsed = resolveFastSearchQuery('retrieval augmented', {
			color: 'yellow',
			hasNote: true
		});

		expect(parsed).toEqual({
			textQuery: 'retrieval augmented',
			filters: {
				color: '#facc15',
				hasNote: true
			}
		});
	});

	it('does not parse inline filter tokens from text', () => {
		const parsed = resolveFastSearchQuery('color:yellow retrieval', {});

		expect(parsed).toEqual({
			textQuery: 'color:yellow retrieval',
			filters: {}
		});
	});

	it('normalizes whitespace in textQuery', () => {
		const parsed = resolveFastSearchQuery('  retrieval   augmented  ', {});

		expect(parsed.textQuery).toBe('retrieval augmented');
	});
});

describe('readFastSearchFiltersFromJson', () => {
	it('reads color and page filters from JSON', () => {
		const filters = readFastSearchFiltersFromJson({
			color: '#3b82f6',
			page: { start: 12, end: 40 }
		});

		expect(filters).toEqual({
			color: '#3b82f6',
			page: { start: 12, end: 40 }
		});
	});

	it('rejects invalid page ranges', () => {
		expect(() =>
			readFastSearchFiltersFromJson({
				page: { start: 40, end: 12 }
			})
		).toThrow(FastSearchQueryError);
	});
});

describe('readFastSearchResultScopeFromJson', () => {
	it('defaults to both when omitted', () => {
		expect(readFastSearchResultScopeFromJson(undefined)).toBe('both');
	});

	it('reads highlights and documents scopes', () => {
		expect(readFastSearchResultScopeFromJson('highlights')).toBe('highlights');
		expect(readFastSearchResultScopeFromJson('documents')).toBe('documents');
	});

	it('rejects unknown scopes', () => {
		expect(() => readFastSearchResultScopeFromJson('unknown')).toThrow(FastSearchQueryError);
	});
});

describe('validatePageFilter', () => {
	it('accepts a single-page range', () => {
		expect(validatePageFilter({ start: 5, end: 5 })).toEqual({ start: 5, end: 5 });
	});
});
