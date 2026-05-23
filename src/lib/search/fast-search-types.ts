import { searchColorFilterValue } from '$lib/highlights/color-slots';

export type PageFilter = {
	start: number;
	end: number;
};

export type FastSearchResultScope = 'both' | 'highlights' | 'documents';

export type FastSearchFilters = {
	documentTitle?: string;
	color?: string;
	hasNote?: true;
	page?: PageFilter;
};

export type FastSearchClientTelemetry = {
	filters: FastSearchFilters;
	resultScope: FastSearchResultScope;
};

export type ParsedFastSearchQuery = {
	textQuery: string;
	filters: FastSearchFilters;
};

export class FastSearchQueryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FastSearchQueryError';
	}
}

export function validatePageFilter(page: PageFilter): PageFilter {
	const start = page.start;
	const end = page.end;
	if (!Number.isInteger(start) || !Number.isInteger(end)) {
		throw new FastSearchQueryError('Page filter must use whole page numbers');
	}
	if (start < 1 || end < 1) {
		throw new FastSearchQueryError('Page filter must be greater than zero');
	}
	if (start > end) {
		throw new FastSearchQueryError('Page filter start must be less than or equal to end');
	}
	return { start, end };
}

export function resolveFastSearchQuery(
	textQuery: string,
	filters: FastSearchFilters
): ParsedFastSearchQuery {
	const normalized: FastSearchFilters = {};

	if (filters.documentTitle !== undefined) {
		const documentTitle = filters.documentTitle.trim();
		if (documentTitle) {
			normalized.documentTitle = documentTitle;
		}
	}

	if (filters.color !== undefined) {
		const color = filters.color.trim();
		if (color) {
			normalized.color = searchColorFilterValue(color);
		}
	}

	if (filters.hasNote === true) {
		normalized.hasNote = true;
	}

	if (filters.page !== undefined) {
		normalized.page = validatePageFilter(filters.page);
	}

	return {
		textQuery: textQuery.trim().replace(/\s+/g, ' '),
		filters: normalized
	};
}

export function readFastSearchFiltersFromJson(value: unknown): FastSearchFilters | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (typeof value !== 'object') {
		throw new FastSearchQueryError('Search filters must be an object.');
	}

	const raw = value as Record<string, unknown>;
	const filters: FastSearchFilters = {};

	if (raw.documentTitle !== undefined) {
		if (typeof raw.documentTitle !== 'string') {
			throw new FastSearchQueryError('Document filter must be text.');
		}
		filters.documentTitle = raw.documentTitle;
	}

	if (raw.color !== undefined) {
		if (typeof raw.color !== 'string') {
			throw new FastSearchQueryError('Color filter must be text.');
		}
		filters.color = raw.color;
	}

	if (raw.hasNote !== undefined) {
		if (raw.hasNote !== true) {
			throw new FastSearchQueryError('Only has:note is supported');
		}
		filters.hasNote = true;
	}

	if (raw.page !== undefined) {
		if (typeof raw.page !== 'object' || raw.page === null) {
			throw new FastSearchQueryError('Page filter must be an object.');
		}
		const pageRaw = raw.page as Record<string, unknown>;
		if (typeof pageRaw.start !== 'number' || typeof pageRaw.end !== 'number') {
			throw new FastSearchQueryError('Page filter must include start and end numbers.');
		}
		filters.page = validatePageFilter({ start: pageRaw.start, end: pageRaw.end });
	}

	return filters;
}

export function hasActiveFastSearchColorFilter(filters: FastSearchFilters): boolean {
	return filters.color !== undefined;
}

export function readFastSearchResultScopeFromJson(value: unknown): FastSearchResultScope {
	if (value === undefined || value === null) {
		return 'both';
	}

	if (typeof value !== 'string') {
		throw new FastSearchQueryError('Result scope must be text.');
	}

	if (value === 'both' || value === 'highlights' || value === 'documents') {
		return value;
	}

	throw new FastSearchQueryError('Result scope must be both, highlights, or documents.');
}
