import { describe, expect, it } from 'vitest';
import { stemmer } from 'stemmer';
import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
import { buildHighlightLexicalCorpus } from './highlight-lexical-corpus';
import {
	matchesHighlightLexical,
	scoreHighlightLexical,
	tokenizeAndStem
} from './highlight-lexical-match';
import { parseWebsearchQuery } from './websearch-query';

function makeHighlight(overrides: Partial<CommentedHighlight> = {}): CommentedHighlight {
	return {
		id: 'hl-1',
		type: 'text',
		content: { text: 'Mitochondria generate cellular energy' },
		position: {
			boundingRect: { left: 0, top: 0, width: 1, height: 1, pageNumber: 1 },
			rects: []
		},
		ordinal: 1,
		...overrides
	};
}

describe('buildHighlightLexicalCorpus', () => {
	it('includes highlighted text, comment, and annotation bodies', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({
				content: { text: 'Highlighted passage' },
				comment: 'Important comment',
				annotations: [
					{
						id: 'a1',
						highlight_id: 'hl-1',
						owner_id: 'u1',
						body: 'Human note body',
						source: 'human',
						created_at: '2026-01-01T00:00:00Z',
						updated_at: '2026-01-01T00:00:00Z'
					},
					{
						id: 'a2',
						highlight_id: 'hl-1',
						owner_id: 'u1',
						body: 'AI interpretation',
						source: 'ai',
						created_at: '2026-01-01T00:00:00Z',
						updated_at: '2026-01-01T00:00:00Z'
					}
				]
			})
		);

		expect(corpus).toContain('Highlighted passage');
		expect(corpus).toContain('Important comment');
		expect(corpus).toContain('Human note body');
		expect(corpus).toContain('AI interpretation');
	});

	it('omits text for area highlights but keeps comment and notes', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({
				type: 'area',
				content: { image: 'https://example.com/shot.png' },
				comment: 'Diagram region',
				annotations: [
					{
						id: 'a1',
						highlight_id: 'hl-1',
						owner_id: 'u1',
						body: 'Figure caption note',
						source: 'human',
						created_at: '2026-01-01T00:00:00Z',
						updated_at: '2026-01-01T00:00:00Z'
					}
				]
			})
		);

		expect(corpus).not.toContain('https://');
		expect(corpus).toContain('Diagram region');
		expect(corpus).toContain('Figure caption note');
	});
});

describe('parseWebsearchQuery', () => {
	it('parses implicit AND terms, quoted phrases, and negation', () => {
		const parsed = parseWebsearchQuery('energy "cellular power" -noise');

		expect(parsed.terms).toEqual(['energy']);
		expect(parsed.phrases).toEqual([['cellular', 'power']]);
		expect(parsed.excluded).toEqual(['noise']);
	});
});

describe('highlight lexical match', () => {
	it('matches annotation notes and comments', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({
				content: { text: 'Unrelated passage' },
				comment: 'Key mechanism',
				annotations: [
					{
						id: 'a1',
						highlight_id: 'hl-1',
						owner_id: 'u1',
						body: 'ATP synthesis detail',
						source: 'human',
						created_at: '2026-01-01T00:00:00Z',
						updated_at: '2026-01-01T00:00:00Z'
					}
				]
			})
		);

		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('ATP'))).toBe(true);
		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('mechanism'))).toBe(true);
	});

	it('requires all terms and supports quoted phrases', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({ content: { text: 'Mitochondria generate cellular energy' } })
		);

		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('mitochondria energy'))).toBe(true);
		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('mitochondria missing'))).toBe(
			false
		);
		expect(
			matchesHighlightLexical(corpus, parseWebsearchQuery('"cellular energy"'))
		).toBe(true);
		expect(
			matchesHighlightLexical(corpus, parseWebsearchQuery('"cellular missing"'))
		).toBe(false);
	});

	it('excludes highlights containing negated terms', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({ content: { text: 'noise experimental artifact' } })
		);

		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('-noise'))).toBe(false);
		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('experimental -noise'))).toBe(
			false
		);
		expect(
			matchesHighlightLexical(corpus, parseWebsearchQuery('experimental -missing'))
		).toBe(true);
	});

	it('matches partial prefixes inside corpus tokens', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({
				content: { text: 'Performance on HotpotQA and LoCoMo datasets' },
				annotations: [
					{
						id: 'a1',
						highlight_id: 'hl-1',
						owner_id: 'u1',
						body: 'HotpotQA achieves the highest score',
						source: 'ai',
						created_at: '2026-01-01T00:00:00Z',
						updated_at: '2026-01-01T00:00:00Z'
					}
				]
			})
		);

		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('hotpot'))).toBe(true);
		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('hotpotqa'))).toBe(true);
		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('loco'))).toBe(true);
	});

	it('stems query tokens to match inflected corpus words', () => {
		const corpus = buildHighlightLexicalCorpus(
			makeHighlight({ content: { text: 'Cells run faster during exercise' } })
		);

		expect(matchesHighlightLexical(corpus, parseWebsearchQuery('running'))).toBe(true);
		expect(tokenizeAndStem('running')).toContain(stemmer('run'));
		expect(tokenizeAndStem('Cells run faster')).toContain(stemmer('run'));
	});

	it('ranks stronger matches above weaker ones', () => {
		const strongCorpus = buildHighlightLexicalCorpus(
			makeHighlight({
				id: 'strong',
				ordinal: 2,
				content: { text: 'Mitochondria generate cellular energy' },
				comment: 'energy pathway'
			})
		);
		const weakCorpus = buildHighlightLexicalCorpus(
			makeHighlight({
				id: 'weak',
				ordinal: 1,
				content: { text: 'Mitochondria only' }
			})
		);
		const parsed = parseWebsearchQuery('mitochondria energy');

		const strongScore = scoreHighlightLexical(strongCorpus, parsed);
		const weakScore = scoreHighlightLexical(weakCorpus, parsed);

		expect(strongScore).toBeGreaterThan(weakScore);
	});
});
