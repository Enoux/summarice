export type ParsedWebsearchQuery = {
	terms: string[];
	phrases: string[][];
	excluded: string[];
};

const TOKEN_PATTERN = /"([^"]+)"|(-[^\s"]+)|([^\s"]+)/g;

export function parseWebsearchQuery(raw: string): ParsedWebsearchQuery {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return { terms: [], phrases: [], excluded: [] };
	}

	const terms: string[] = [];
	const phrases: string[][] = [];
	const excluded: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = TOKEN_PATTERN.exec(trimmed)) !== null) {
		const quoted = match[1];
		const negated = match[2];
		const bare = match[3];

		if (quoted !== undefined) {
			const phraseTokens = tokenizePhrase(quoted);
			if (phraseTokens.length > 0) {
				phrases.push(phraseTokens);
			}
			continue;
		}

		if (negated !== undefined) {
			const value = negated.slice(1).trim();
			if (value.length > 0) {
				excluded.push(value);
			}
			continue;
		}

		if (bare !== undefined) {
			const value = bare.trim();
			if (value.length > 0) {
				terms.push(value);
			}
		}
	}

	return { terms, phrases, excluded };
}

function tokenizePhrase(phrase: string): string[] {
	return phrase
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
}
