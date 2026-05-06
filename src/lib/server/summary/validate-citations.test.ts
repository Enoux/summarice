import { describe, expect, it } from 'vitest';
import { validateAndExtractCitations } from './validate-citations';

describe('validateAndExtractCitations', () => {
	it('keeps only whitelisted citation tokens and extracts citations', () => {
		const result = validateAndExtractCitations(
			'Claim one[^1] and claim two[^2]. Unsupported[^9] and repeated[^2].',
			[1, 2]
		);

		expect(result.cleanedMarkdown).toBe(
			'Claim one[^1] and claim two[^2]. Unsupported and repeated[^2].'
		);
		expect(result.citations).toEqual([
			{ ordinal: 1, occurrenceIndex: 0 },
			{ ordinal: 2, occurrenceIndex: 1 },
			{ ordinal: 2, occurrenceIndex: 2 }
		]);
	});

	it('strips spaces left behind before punctuation when removing invalid citations', () => {
		const result = validateAndExtractCitations('A point [^7], then another [^3].', [3]);

		expect(result.cleanedMarkdown).toBe('A point, then another [^3].');
		expect(result.citations).toEqual([{ ordinal: 3, occurrenceIndex: 0 }]);
	});

	it('returns no citations when markdown contains no citation tokens', () => {
		const result = validateAndExtractCitations('No cited material here.', [1]);

		expect(result.cleanedMarkdown).toBe('No cited material here.');
		expect(result.citations).toEqual([]);
	});
});
