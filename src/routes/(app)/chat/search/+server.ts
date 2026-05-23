import { json, type RequestHandler } from '@sveltejs/kit';
import { errorMessage } from '$lib/server/error-message';
import {
	readFastSearchFiltersFromJson,
	readFastSearchResultScopeFromJson
} from '$lib/search/fast-search-types';
import {
	FastSearchQueryError,
	searchFastLibraryDirect,
	searchFastLibraryEnrichment,
	searchFastLibrarySemantic,
	type FastSearchResponse
} from '$lib/server/search/fast-library-search';

type FastSearchRequestBody = {
	query?: unknown;
	filters?: unknown;
	resultScope?: unknown;
	previousResponse?: unknown;
	lexicalResponse?: unknown;
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to search your library.' }, { status: 401 });
	}

	let body: FastSearchRequestBody;
	try {
		body = await readFastSearchRequestBody(request);
	} catch (error) {
		if (error instanceof FastSearchQueryError) {
			return json({ error: error.message }, { status: 400 });
		}

		throw error;
	}

	if (typeof body.query !== 'string') {
		return json({ error: 'Search query must be text.' }, { status: 400 });
	}

	try {
		const url = new URL(request.url);
		const stage = url.searchParams.get('stage');
		const clientFilters =
			body.filters === undefined ? {} : readFastSearchFiltersFromJson(body.filters) ?? {};
		const resultScope = readFastSearchResultScopeFromJson(body.resultScope);
		const baseOptions = {
			supabase: locals.supabase,
			ownerId: locals.user.id,
			rawQuery: body.query,
			clientFilters,
			resultScope
		};
		const previousResponse = readOptionalPreviousResponse(body);
		const response = await searchStage(stage, baseOptions, previousResponse);

		return json(response);
	} catch (error) {
		if (error instanceof FastSearchQueryError) {
			return json({ error: error.message }, { status: 400 });
		}

		console.error('[fast-library-search endpoint]', {
			userId: locals.user.id,
			error: errorMessage(error, {
				operation: 'fast library search endpoint',
				params: { userId: locals.user.id }
			})
		});

		return json({ error: 'Search is unavailable right now.' }, { status: 500 });
	}
};

async function readFastSearchRequestBody(request: Request): Promise<FastSearchRequestBody> {
	try {
		return (await request.json()) as FastSearchRequestBody;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new FastSearchQueryError('Request body must be valid JSON.');
		}

		throw error;
	}
}

async function searchStage(
	stage: string | null,
	baseOptions: Parameters<typeof searchFastLibraryDirect>[0],
	previousResponse: FastSearchResponse | null
): Promise<FastSearchResponse> {
	if (stage === 'semantic') {
		return searchFastLibrarySemantic(baseOptions, requirePreviousResponse(previousResponse, 'Semantic'));
	}

	if (stage === 'enrichment') {
		return searchFastLibraryEnrichment(baseOptions, requirePreviousResponse(previousResponse, 'Enrichment'));
	}

	return searchFastLibraryDirect(baseOptions);
}

function readOptionalPreviousResponse(body: FastSearchRequestBody): FastSearchResponse | null {
	const response = body.previousResponse ?? body.lexicalResponse;
	if (response === undefined || response === null) return null;
	return readPreviousResponse(response);
}

function requirePreviousResponse(
	response: FastSearchResponse | null,
	stageLabel: string
): FastSearchResponse {
	if (!response) {
		throw new FastSearchQueryError(`${stageLabel} search requires a previous response.`);
	}

	return response;
}

function readPreviousResponse(response: unknown): FastSearchResponse {
	if (!response || typeof response !== 'object') {
		throw new FastSearchQueryError('Previous search response must be an object.');
	}

	return response as FastSearchResponse;
}
