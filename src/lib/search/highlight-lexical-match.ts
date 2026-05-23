import { stemmer } from 'stemmer';
import type { ParsedWebsearchQuery } from './websearch-query';

const WORD_PATTERN = /[a-z0-9]+/gi;

export type CorpusTokens = {
	raw: string[];
	stemmed: string[];
};

export function tokenizeCorpus(text: string): CorpusTokens {
	const raw: string[] = [];
	const stemmed: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = WORD_PATTERN.exec(text)) !== null) {
		const normalized = match[0].toLowerCase();
		if (normalized.length === 0) {
			continue;
		}
		raw.push(normalized);
		stemmed.push(stemmer(normalized));
	}
	return { raw, stemmed };
}

/** @deprecated Use tokenizeCorpus for new code. */
export function tokenizeAndStem(text: string): string[] {
	return tokenizeCorpus(text).stemmed;
}

export function matchesHighlightLexical(corpus: string, parsed: ParsedWebsearchQuery): boolean {
	const tokens = tokenizeCorpus(corpus);

	for (const excluded of parsed.excluded) {
		if (termMatches(tokens, excluded)) {
			return false;
		}
	}

	const hasPositiveQuery = parsed.terms.length > 0 || parsed.phrases.length > 0;
	if (!hasPositiveQuery) {
		return true;
	}

	for (const term of parsed.terms) {
		if (!termMatches(tokens, term)) {
			return false;
		}
	}

	for (const phrase of parsed.phrases) {
		if (!phraseMatches(tokens, phrase)) {
			return false;
		}
	}

	return true;
}

export function scoreHighlightLexical(corpus: string, parsed: ParsedWebsearchQuery): number {
	if (!matchesHighlightLexical(corpus, parsed)) {
		return 0;
	}

	const tokens = tokenizeCorpus(corpus);
	let score = 0;

	for (const term of parsed.terms) {
		if (termMatches(tokens, term)) {
			score += 1;
		}
	}

	for (const phrase of parsed.phrases) {
		if (phraseMatches(tokens, phrase)) {
			score += phrase.length;
		}
	}

	return score;
}

function termMatches(tokens: CorpusTokens, term: string): boolean {
	const normalized = term.toLowerCase();
	if (normalized.length === 0) {
		return true;
	}

	const stemmedTerm = stemmer(normalized);

	for (let index = 0; index < tokens.raw.length; index += 1) {
		if (tokenAtMatches(tokens, index, normalized, stemmedTerm)) {
			return true;
		}
	}

	return false;
}

function phraseMatches(tokens: CorpusTokens, phrase: string[]): boolean {
	if (phrase.length === 0) {
		return true;
	}

	if (phrase.length > tokens.raw.length) {
		return false;
	}

	for (let start = 0; start <= tokens.raw.length - phrase.length; start += 1) {
		let matches = true;
		for (let index = 0; index < phrase.length; index += 1) {
			const normalized = phrase[index].toLowerCase();
			if (
				!tokenAtMatches(tokens, start + index, normalized, stemmer(normalized))
			) {
				matches = false;
				break;
			}
		}
		if (matches) {
			return true;
		}
	}

	return false;
}

function tokenAtMatches(
	tokens: CorpusTokens,
	index: number,
	normalized: string,
	stemmedTerm: string
): boolean {
	const raw = tokens.raw[index];
	const stem = tokens.stemmed[index];

	if (stem === stemmedTerm) {
		return true;
	}

	if (raw.startsWith(normalized)) {
		return true;
	}

	if (stemmedTerm.length > 0 && stem.startsWith(stemmedTerm)) {
		return true;
	}

	return false;
}
