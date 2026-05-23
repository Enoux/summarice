import { describe, expect, it } from 'vitest';
import {
	buildPartialExcludedTerms,
	buildPartialSearchTerms
} from './partial-search-terms';

describe('buildPartialSearchTerms', () => {
	it('returns empty arrays for blank text query', () => {
		expect(buildPartialSearchTerms('')).toEqual([]);
		expect(buildPartialExcludedTerms('')).toEqual([]);
	});

	it('flattens bare terms and quoted phrase tokens', () => {
		expect(buildPartialSearchTerms('hotpot "cellular energy"')).toEqual([
			'hotpot',
			'cellular',
			'energy'
		]);
	});

	it('extracts excluded terms separately', () => {
		expect(buildPartialSearchTerms('hotpot -noise')).toEqual(['hotpot']);
		expect(buildPartialExcludedTerms('hotpot -noise')).toEqual(['noise']);
	});
});
