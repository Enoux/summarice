import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';

import CitationPill from './CitationPill.svelte';

// Helper: build a minimal CommentedHighlight fixture
function makeHighlight(overrides: Record<string, unknown> = {}) {
	return {
		id: 'hl-abc',
		type: 'text' as const,
		content: { text: 'some text' },
		position: {
			boundingRect: { x1: 0, y1: 0, x2: 10, y2: 10, width: 100, height: 100, pageNumber: 2 },
			rects: []
		},
		ordinal: 1,
		display_color: '#3b82f6', // blue (slot 3 — resolveHighlightColor returns same hex in light mode)
		...overrides
	};
}

describe('CitationPill', () => {
	it('renders the correct ordinal number', () => {
		const result = render(CitationPill, {
			props: { ordinal: 7, highlight: makeHighlight({ ordinal: 7 }) }
		});
		expect(result.body).toContain('>7<');
	});

	it('applies the highlight display_color as background-color when highlight is provided', () => {
		const highlight = makeHighlight({ display_color: '#22c55e' }); // green
		const result = render(CitationPill, { props: { ordinal: 1, highlight } });
		// resolveHighlightColor returns the hex unchanged in light mode
		expect(result.body).toContain('#22c55e');
	});

	it('falls back to var(--primary) when highlight has no display_color', () => {
		const highlight = makeHighlight({ display_color: undefined });
		const result = render(CitationPill, { props: { ordinal: 2, highlight } });
		expect(result.body).toContain('var(--primary)');
	});

	it('sets the id attribute when id prop is provided', () => {
		const result = render(CitationPill, {
			props: { id: 'summary-citation-hl-abc', ordinal: 1, highlight: makeHighlight() }
		});
		expect(result.body).toContain('id="summary-citation-hl-abc"');
	});

	describe('when highlight is null (deleted)', () => {
		it('renders with title="highlight has been deleted"', () => {
			const result = render(CitationPill, { props: { ordinal: 3, highlight: null } });
			expect(result.body).toContain('title="highlight has been deleted"');
		});

		it('renders with opacity-60 and cursor-not-allowed classes', () => {
			const result = render(CitationPill, { props: { ordinal: 3, highlight: null } });
			expect(result.body).toContain('opacity-60');
			expect(result.body).toContain('cursor-not-allowed');
		});

		it('uses muted background color (not primary) for deleted pills', () => {
			const result = render(CitationPill, { props: { ordinal: 3, highlight: null } });
			expect(result.body).toContain('var(--muted-foreground)');
		});

		it('still renders the ordinal number', () => {
			const result = render(CitationPill, { props: { ordinal: 42, highlight: null } });
			expect(result.body).toContain('>42<');
		});
	});
});
