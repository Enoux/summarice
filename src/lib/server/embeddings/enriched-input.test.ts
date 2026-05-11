import { describe, expect, it } from 'vitest';

import { buildHighlightEmbeddingInput } from './highlight-embedding-service';

describe('buildHighlightEmbeddingInput', () => {
	it('builds enriched input without outline headings or screenshot data', () => {
		const input = buildHighlightEmbeddingInput({
			document: {
				title: 'Attention Is Also a Habit'
			},
			highlight: {
				kind: 'area',
				page_number: 7,
				text: 'Ignored OCR text',
				comment: '  Legacy note  ',
				screenshot_path: 'user/doc/highlight.png'
			},
			annotations: [
				{
					body: 'Second human note',
					source: 'human',
					created_at: '2026-01-02T00:00:00.000Z'
				},
				{
					body: 'AI figure interpretation',
					source: 'ai',
					created_at: '2026-01-01T00:00:00.000Z'
				},
				{
					body: 'First human note',
					source: 'human',
					created_at: '2026-01-01T00:00:00.000Z'
				}
			]
		});

		expect(input).toBe(
			'Attention Is Also a Habit / Page 7 / [area highlight] / User note: Legacy note\nFirst human note\nSecond human note / AI interpretation: AI figure interpretation'
		);
		expect(input).not.toContain('outline');
		expect(input).not.toContain('user/doc/highlight.png');
	});

	it('uses text highlight content when the highlight is textual', () => {
		const input = buildHighlightEmbeddingInput({
			document: {
				title: 'Retrieval Notes'
			},
			highlight: {
				kind: 'text',
				page_number: 3,
				text: 'Dense retrieval helps find paraphrases.',
				comment: null,
				screenshot_path: null
			},
			annotations: []
		});

		expect(input).toBe('Retrieval Notes / Page 3 / Dense retrieval helps find paraphrases.');
	});
});
