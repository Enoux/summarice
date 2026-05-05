export type CitationValidationResult = {
	cleanedMarkdown: string;
	citations: Array<{ ordinal: number; occurrenceIndex: number }>;
};

const CITATION_TOKEN_RE = /\[\^(\d+)\]/g;

export function validateAndExtractCitations(
	markdown: string,
	ordinalWhitelist: Iterable<number>
): CitationValidationResult {
	const allowed = new Set(ordinalWhitelist);
	const citations: Array<{ ordinal: number; occurrenceIndex: number }> = [];
	let occurrenceIndex = 0;

	const cleaned = markdown
		.replace(CITATION_TOKEN_RE, (token, rawOrdinal: string) => {
			const ordinal = Number.parseInt(rawOrdinal, 10);
			if (allowed.has(ordinal)) {
				citations.push({ ordinal, occurrenceIndex: occurrenceIndex++ });
				return token;
			}
			return '';
		})
		.replace(/\s+([,.;:!?])/g, '$1')
		.replace(/\(\s+/g, '(')
		.replace(/\s+\)/g, ')')
		.replace(/[ \t]{2,}/g, ' ');

	return {
		cleanedMarkdown: cleaned,
		citations
	};
}

export const validateSummaryCitations = validateAndExtractCitations;
