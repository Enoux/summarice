import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';

import SummaryContent from './SummaryContent.svelte';

// Minimal highlight fixture matching CommentedHighlight shape
function makeHighlight(id: string, ordinal: number, color = '#facc15') {
	return {
		id,
		type: 'text' as const,
		content: { text: `highlight ${id}` },
		position: {
			boundingRect: { x1: 0, y1: 0, x2: 10, y2: 10, width: 100, height: 100, pageNumber: 1 },
			rects: []
		},
		ordinal,
		display_color: color
	};
}

const h1 = makeHighlight('h1', 1);
const h2 = makeHighlight('h2', 2);
const highlights = [h1, h2];

// NOTE on paragraph id contract: SummaryContent sets id="summary-citation-{highlight.id}"
// on the FIRST occurrence of a citation in ANY block type (h1, h2, h3, <p>).
// This was confirmed by running the SSR renderer — <p> blocks do pass the id prop.
describe('SummaryContent paragraph rendering', () => {
	const markdown = 'This[^1] is[^2] a test[^1] with[^999].';

	it('renders 3 ordinal pills for valid citations (1, 2, 1) and 1 null pill for unknown ordinal 999', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		const body = result.body;
		// ordinal 1 appears twice in the markdown → two pills
		const pill1Matches = [...body.matchAll(/>1</g)];
		expect(pill1Matches.length).toBe(2);
		// ordinal 2 appears once
		const pill2Matches = [...body.matchAll(/>2</g)];
		expect(pill2Matches.length).toBe(1);
		// ordinal 999 has no matching highlight → renders as deleted pill (null highlight), not stripped
		const pill999Matches = [...body.matchAll(/>999</g)];
		expect(pill999Matches.length).toBe(1);
	});

	it('renders the [^999] pill as deleted (title="highlight has been deleted")', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		// Unknown ordinal → null highlight → CitationPill receives highlight=null → greyed state
		expect(result.body).toContain('title="highlight has been deleted"');
	});

	it('sets id="summary-citation-h1" on the FIRST pill for ordinal 1 (paragraph block)', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		// All block types (including <p>) wire up summary-citation-{id} on the first occurrence
		expect(result.body).toContain('id="summary-citation-h1"');
	});

	it('does NOT set id on the SECOND occurrence of ordinal 1 in the same block', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		// id should appear exactly once — second [^1] is not the first occurrence
		const matches = [...result.body.matchAll(/id="summary-citation-h1"/g)];
		expect(matches.length).toBe(1);
	});

	it('does NOT set id on [^999] pill because highlight is null', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		// null highlight → highlight?.id is undefined → no id prop passed
		expect(result.body).not.toContain('id="summary-citation-undefined"');
		expect(result.body).not.toContain('id="summary-citation-999"');
	});

	it('renders the plain text segments between citations', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		expect(result.body).toContain('This');
		expect(result.body).toContain('is');
		expect(result.body).toContain('a test');
		expect(result.body).toContain('with');
	});
});

// Heading markdown: h1 block → CitationPill ids ARE set for first occurrence only
describe('SummaryContent heading id wiring', () => {
	// Two paragraphs: first is h1 with [^1] and [^2], second is a paragraph with another [^1]
	const markdown = '# Title with[^1] and[^2]\n\nParagraph with[^1] again.';

	it('sets id="summary-citation-{highlight.id}" on the first occurrence of a citation in h1', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		expect(result.body).toContain('id="summary-citation-h1"');
		expect(result.body).toContain('id="summary-citation-h2"');
	});

	it('does NOT set id on the second occurrence of [^1] (in the paragraph block after h1)', () => {
		const result = render(SummaryContent, { props: { markdown, highlights } });
		// seenOrdinals is shared across blocks — after h1 sees ordinal 1, the <p> block's
		// [^1] is NOT marked isFirst, so no id is emitted for the second occurrence
		const matches = [...result.body.matchAll(/id="summary-citation-h1"/g)];
		expect(matches.length).toBe(1);
	});
});
