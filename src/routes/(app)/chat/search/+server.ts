import { json, type RequestHandler } from '@sveltejs/kit';
import { errorMessage } from '$lib/server/error-message';
import {
	FastSearchQueryError,
	searchFastLibraryLexical,
	searchFastLibrarySemantic,
	type FastSearchResponse
} from '$lib/server/search/fast-library-search';

type FastSearchRequestBody = {
	query?: unknown;
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
		const baseOptions = {
			supabase: locals.supabase,
			ownerId: locals.user.id,
			rawQuery: body.query
		};
		const response =
			stage === 'semantic'
				? await searchFastLibrarySemantic(baseOptions, readLexicalResponse(body.lexicalResponse))
				: await searchFastLibraryLexical(baseOptions);

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

function readLexicalResponse(response: unknown): FastSearchResponse {
	if (!response || typeof response !== 'object') {
		throw new FastSearchQueryError('Semantic search requires a lexical response.');
	}

	return response as FastSearchResponse;
}
