import { describe, expect, it } from 'vitest';
import { buildSummaryPrompt } from './build-summary-prompt';

function chainResult(result: unknown) {
	const builder = {
		select: () => builder,
		eq: () => builder,
		order: async () => result,
		maybeSingle: async () => result
	};
	return builder;
}

function supabaseFor(opts: {
	decorative: boolean;
	categoryLabels?: Record<string, string> | null;
	pages: Array<{ document_id: string; page_number: number; text: string }>;
	highlights: unknown[];
}) {
	return {
		from: (table: string) => {
			if (table === 'documents') {
				return chainResult({
					data: {
						id: 'doc-1',
						owner_id: 'user-1',
						title: opts.decorative ? 'Decorative Colors Only' : 'Attention Is Also a Habit',
						page_count: opts.pages.length
					},
					error: null
				});
			}
			if (table === 'document_pages') {
				return chainResult({ data: opts.pages, error: null });
			}
			if (table === 'highlights') {
				return chainResult({ data: opts.highlights, error: null });
			}
			if (table === 'user_settings') {
				return chainResult({
					data: {
						id: 'user-1',
						category_labels: opts.categoryLabels,
						use_colors_decoratively: opts.decorative
					},
					error: null
				});
			}
			throw new Error(`Unexpected table: ${table}`);
		}
	};
}

describe('buildSummaryPrompt', () => {
	it('builds a semantic summary prompt with embedded highlight tags and ordered whitelist', async () => {
		const prompt = await buildSummaryPrompt(
			supabaseFor({
				decorative: false,
				categoryLabels: {
					'1': 'Key idea',
					'4': 'Question'
				},
				pages: [
					{
						document_id: 'doc-1',
						page_number: 2,
						text: 'Second page mentions unresolved baselines.'
					},
					{
						document_id: 'doc-1',
						page_number: 1,
						text: 'Important finding appears in the introduction.'
					}
				],
				highlights: [
					{
						id: 'hl-2',
						document_id: 'doc-1',
						owner_id: 'user-1',
						ordinal: 2,
						kind: 'text',
						page_number: 2,
						text: 'missing snippet',
						comment: null,
						screenshot_path: null,
						bounding_box: { boundingRect: { pageNumber: 2 }, rects: [] },
						category: 4,
						color: '#f59e0b',
						created_at: '2026-05-04T10:00:00Z',
						annotations: [
							{
								id: 'ann-2',
								highlight_id: 'hl-2',
								owner_id: 'user-1',
								body: 'Double-check the baseline.',
								source: 'human',
								created_at: '2026-05-04T10:01:00Z',
								updated_at: '2026-05-04T10:01:00Z'
							}
						]
					},
					{
						id: 'hl-1',
						document_id: 'doc-1',
						owner_id: 'user-1',
						ordinal: 1,
						kind: 'text',
						page_number: 1,
						text: 'Important finding',
						comment: 'Anchor this in the summary.',
						screenshot_path: null,
						bounding_box: { boundingRect: { pageNumber: 1 }, rects: [] },
						category: 1,
						color: '#60a5fa',
						created_at: '2026-05-04T09:00:00Z',
						annotations: [
							{
								id: 'ann-1',
								highlight_id: 'hl-1',
								owner_id: 'user-1',
								body: 'This matters for the abstract too.',
								source: 'ai',
								created_at: '2026-05-04T09:01:00Z',
								updated_at: '2026-05-04T09:01:00Z'
							}
						]
					}
				]
			}) as never,
			{
				documentId: 'doc-1',
				ownerId: 'user-1'
			}
		);

		expect(prompt.model).toBe('google/gemini-2.5-flash');
		expect(prompt.ordinalWhitelist).toEqual([1, 2]);
		expect(prompt.cachedPrefixCharCount).toBeGreaterThan(0);
		expect(prompt.messages).toHaveLength(1);
		expect(prompt.messages[0]?.role).toBe('user');

		const text = String(prompt.messages[0]?.content);
		expect(prompt.system).toContain('markdown footnote tokens');
		expect(text).toContain('Slot 1: Key idea');
		expect(text).toContain('Slot 2: Definition');
		expect(text).toContain(
			'<highlight id="1" page="1" slot="1" category="Key idea">Important finding</highlight>'
		);
		expect(text).toContain(
			'<highlight id="2" page="2" slot="4" category="Question" text="missing snippet" />'
		);
		expect(text).toContain('<comment>Anchor this in the summary.</comment>');
		expect(text).toContain('<annotation source="ai">This matters for the abstract too.</annotation>');
		expect(text).toContain(
			'<annotation source="human">Double-check the baseline.</annotation>'
		);
		expect(text.indexOf('<page n="1">')).toBeLessThan(text.indexOf('<page n="2">'));
		expect(text.indexOf('id="1"')).toBeLessThan(text.indexOf('id="2"'));
	});

	it('omits semantic category labels in decorative mode', async () => {
		const prompt = await buildSummaryPrompt(
			supabaseFor({
				decorative: true,
				categoryLabels: null,
				pages: [{ document_id: 'doc-1', page_number: 1, text: 'A colored sentence.' }],
				highlights: [
					{
						id: 'hl-1',
						document_id: 'doc-1',
						owner_id: 'user-1',
						ordinal: 1,
						kind: 'text',
						page_number: 1,
						text: 'colored sentence',
						comment: null,
						screenshot_path: null,
						bounding_box: { boundingRect: { pageNumber: 1 }, rects: [] },
						category: null,
						color: '#ff00aa',
						created_at: '2026-05-04T09:00:00Z',
						annotations: []
					}
				]
			}) as never,
			{
				documentId: 'doc-1',
				ownerId: 'user-1'
			}
		);

		const text = String(prompt.messages[0]?.content);
		expect(text.toLowerCase()).toContain('decorative');
		expect(text).not.toContain('category=');
		expect(text).not.toContain('Slot 1:');
	});
});
