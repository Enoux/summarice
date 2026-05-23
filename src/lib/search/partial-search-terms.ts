import { parseWebsearchQuery } from './websearch-query';

export function buildPartialSearchTerms(textQuery: string): string[] {
	const parsed = parseWebsearchQuery(textQuery);
	const terms = [...parsed.terms];

	for (const phrase of parsed.phrases) {
		for (const token of phrase) {
			terms.push(token);
		}
	}

	return terms;
}

export function buildPartialExcludedTerms(textQuery: string): string[] {
	return parseWebsearchQuery(textQuery).excluded;
}
