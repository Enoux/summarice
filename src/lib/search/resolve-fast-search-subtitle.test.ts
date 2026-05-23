import { describe, expect, it } from 'vitest';
import type { FastSearchClientHighlightResult } from '$lib/search/apply-fast-search-client-filters';
import { resolveFastSearchSubtitle } from '$lib/search/resolve-fast-search-subtitle';
import type { ParsedWebsearchQuery } from '$lib/search/websearch-query';

const emptyQuery: ParsedWebsearchQuery = { terms: [], phrases: [], excluded: [] };
const aiQuery: ParsedWebsearchQuery = { terms: ['vision'], phrases: [], excluded: [] };
const postureQuery: ParsedWebsearchQuery = { terms: ['posture'], phrases: [], excluded: [] };
const commentQuery: ParsedWebsearchQuery = { terms: ['baseline'], phrases: [], excluded: [] };

function highlightResult(
	overrides: Partial<FastSearchClientHighlightResult>
): FastSearchClientHighlightResult {
	return {
		kind: 'direct_highlight',
		highlightId: 'h-1',
		documentId: 'doc-1',
		documentTitle: 'Doc',
		pageNumber: 1,
		highlightKind: 'text',
		text: 'highlighted passage about posture correction',
		comment: null,
		annotationPreview: null,
		aiAnnotationPreview: null,
		color: '#facc15',
		href: '/doc/doc-1#highlight-h-1',
		...overrides
	};
}

describe('resolveFastSearchSubtitle', () => {
	it('shows AI interpretation for area highlights', () => {
		const subtitle = resolveFastSearchSubtitle(
			highlightResult({
				highlightKind: 'area',
				text: null,
				aiAnnotationPreview: 'Computer vision posture analysis for desk workers'
			}),
			emptyQuery
		);

		expect(subtitle.primary).toBe('Computer vision posture analysis for desk workers');
		expect(subtitle.showAnnotationLine).toBe(false);
	});

	it('prefers annotation text when only the note matches', () => {
		const subtitle = resolveFastSearchSubtitle(
			highlightResult({
				text: 'unrelated highlight text',
				annotationPreview: 'posture correction using computer vision'
			}),
			postureQuery
		);

		expect(subtitle.primary).toBe('posture correction using computer vision');
		expect(subtitle.showAnnotationLine).toBe(false);
	});

	it('prefers annotation text when both highlight and note match', () => {
		const subtitle = resolveFastSearchSubtitle(
			highlightResult({
				text: 'posture correction in the PDF body',
				annotationPreview: 'posture correction using computer vision'
			}),
			postureQuery
		);

		expect(subtitle.primary).toBe('posture correction using computer vision');
		expect(subtitle.showAnnotationLine).toBe(false);
	});

	it('shows comment text when only the comment matches', () => {
		const subtitle = resolveFastSearchSubtitle(
			highlightResult({
				text: 'unrelated highlight text',
				comment: 'Double-check the baseline measurement'
			}),
			commentQuery
		);

		expect(subtitle.primary).toBe('Double-check the baseline measurement');
		expect(subtitle.showAnnotationLine).toBe(false);
	});

	it('falls back to area label when no interpretation exists', () => {
		const subtitle = resolveFastSearchSubtitle(
			highlightResult({
				highlightKind: 'area',
				text: null,
				annotationPreview: null,
				aiAnnotationPreview: null
			}),
			aiQuery
		);

		expect(subtitle.primary).toBe('[area highlight]');
	});
});
