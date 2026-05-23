import { describe, expect, it } from 'vitest';
import {
	applyFastSearchClientFilters,
	type FastSearchClientLane
} from '$lib/search/apply-fast-search-client-filters';

function highlightLane(
	id: 'direct' | 'summary' | 'semantic',
	highlightId: string,
	color: string
): FastSearchClientLane {
	return {
		id,
		label: id,
		results: [
			{
				kind: 'direct_highlight',
				highlightId,
				documentId: 'doc-1',
				documentTitle: 'Doc',
				pageNumber: 1,
				highlightKind: 'text',
				text: 'text',
				comment: null,
				annotationPreview: null,
				aiAnnotationPreview: null,
				color,
				href: `/doc/doc-1#highlight-${highlightId}`
			}
		]
	};
}

function documentLane(): FastSearchClientLane {
	return {
		id: 'document',
		label: 'Document matches',
		results: [
			{
				kind: 'document',
				documentId: 'doc-2',
				documentTitle: 'Other Doc',
				text: 'summary snippet',
				href: '/doc/doc-2'
			}
		]
	};
}

describe('applyFastSearchClientFilters', () => {
	const lanes: FastSearchClientLane[] = [
		highlightLane('direct', 'h-yellow', '#facc15'),
		highlightLane('summary', 'h-blue', '#3b82f6'),
		documentLane()
	];

	it('keeps all lanes when scope is both and no color filter', () => {
		const filtered = applyFastSearchClientFilters(lanes, {}, 'both');
		expect(filtered.map((lane) => [lane.id, lane.results.length])).toEqual([
			['direct', 1],
			['summary', 1],
			['document', 1]
		]);
	});

	it('limits to highlight lanes when scope is highlights', () => {
		const filtered = applyFastSearchClientFilters(lanes, {}, 'highlights');
		expect(filtered.map((lane) => lane.id)).toEqual(['direct', 'summary']);
	});

	it('limits to document lane when scope is documents', () => {
		const filtered = applyFastSearchClientFilters(lanes, {}, 'documents');
		expect(filtered.map((lane) => lane.id)).toEqual(['document']);
	});

	it('filters highlight rows by color without removing document rows', () => {
		const filtered = applyFastSearchClientFilters(lanes, { color: '#facc15' }, 'both');
		expect(filtered).toEqual([
			{ ...lanes[0], results: [lanes[0].results[0]] },
			{ ...lanes[1], results: [] },
			lanes[2]
		]);
	});

	it('applies color filter within highlights scope', () => {
		const filtered = applyFastSearchClientFilters(lanes, { color: '#3b82f6' }, 'highlights');
		expect(filtered.map((lane) => [lane.id, lane.results.length])).toEqual([
			['direct', 0],
			['summary', 1]
		]);
	});
});
