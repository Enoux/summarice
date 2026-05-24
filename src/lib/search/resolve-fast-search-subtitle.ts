import type {
	FastSearchClientDocumentResult,
	FastSearchClientHighlightResult,
	FastSearchClientResult
} from '$lib/search/apply-fast-search-client-filters';
import {
	matchesHighlightLexical,
	scoreHighlightLexical
} from '$lib/search/highlight-lexical-match';
import type { ParsedWebsearchQuery } from '$lib/search/websearch-query';

export type FastSearchSubtitle = {
	primary: string;
	themesLine: string | null;
	entitiesLine: string | null;
	showAnnotationLine: boolean;
};

type NoteField = {
	text: string;
	matches: boolean;
	score: number;
};

const AREA_FALLBACK = '[area highlight]';

function trimmed(value: string | null | undefined): string {
	return value?.trim() ?? '';
}

function nonEmptyValues(values: string[]): string[] {
	return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function resolveDocumentSubtitle(result: FastSearchClientDocumentResult): FastSearchSubtitle {
	const tags = nonEmptyValues(result.tags);
	const entities = nonEmptyValues(result.entities);
	const themesLine = tags.length > 0 ? `Themes: ${tags.join(', ')}` : null;
	const entitiesLine = entities.length > 0 ? `Key Entities: ${entities.join(', ')}` : null;

	return {
		primary: themesLine === null && entitiesLine === null ? trimmed(result.text) : '',
		themesLine,
		entitiesLine,
		showAnnotationLine: false
	};
}

function noteField(text: string, parsedQuery: ParsedWebsearchQuery): NoteField | null {
	if (text.length === 0) {
		return null;
	}

	const matches = matchesHighlightLexical(text, parsedQuery);
	if (!matches) {
		return null;
	}

	return {
		text,
		matches: true,
		score: scoreHighlightLexical(text, parsedQuery)
	};
}

function pickBestNoteField(fields: NoteField[]): NoteField | null {
	if (fields.length === 0) {
		return null;
	}

	return fields.reduce((best, current) => (current.score > best.score ? current : best));
}

function areaPrimaryText(result: FastSearchClientHighlightResult): string {
	const aiText = trimmed(result.aiAnnotationPreview);
	if (aiText.length > 0) {
		return aiText;
	}

	const annotationText = trimmed(result.annotationPreview);
	if (annotationText.length > 0) {
		return annotationText;
	}

	return AREA_FALLBACK;
}

function textHighlightPrimaryText(result: FastSearchClientHighlightResult): string {
	return trimmed(result.text) || AREA_FALLBACK;
}

function resolveTextHighlightSubtitle(
	result: FastSearchClientHighlightResult,
	parsedQuery: ParsedWebsearchQuery
): FastSearchSubtitle {
	const highlightText = trimmed(result.text);
	const fallbackPrimary = textHighlightPrimaryText(result);

	const matchingNotes = [
		noteField(trimmed(result.comment), parsedQuery),
		noteField(trimmed(result.annotationPreview), parsedQuery)
	].filter((field): field is NoteField => field !== null);

	const bestNote = pickBestNoteField(matchingNotes);
	if (bestNote !== null) {
		return {
			primary: bestNote.text,
			themesLine: null,
			entitiesLine: null,
			showAnnotationLine: false
		};
	}

	const annotationText = trimmed(result.annotationPreview);
	return {
		primary: fallbackPrimary,
		themesLine: null,
		entitiesLine: null,
		showAnnotationLine:
			annotationText.length > 0 && annotationText !== fallbackPrimary
	};
}

function resolveHighlightSubtitle(
	result: FastSearchClientHighlightResult,
	parsedQuery: ParsedWebsearchQuery
): FastSearchSubtitle {
	if (result.highlightKind === 'area') {
		return {
			primary: areaPrimaryText(result),
			themesLine: null,
			entitiesLine: null,
			showAnnotationLine: false
		};
	}

	return resolveTextHighlightSubtitle(result, parsedQuery);
}

export function resolveFastSearchSubtitle(
	result: FastSearchClientResult,
	parsedQuery: ParsedWebsearchQuery
): FastSearchSubtitle {
	if (result.kind === 'document') {
		return resolveDocumentSubtitle(result);
	}

	return resolveHighlightSubtitle(result, parsedQuery);
}
