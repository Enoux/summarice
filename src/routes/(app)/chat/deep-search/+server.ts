import { json, type RequestHandler } from '@sveltejs/kit';

import { errorMessage } from '$lib/server/error-message';
import { searchDeepLibrary } from '$lib/server/search/deep-library-search';
import type { DeepLibrarySearchStatusStep } from '$lib/search/deep-library-search-types';

const encoder = new TextEncoder();

type DeepSearchRequestBody = {
	prompt?: unknown;
	currentDocumentId?: unknown;
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to search your library.' }, { status: 401 });
	}

	let body: DeepSearchRequestBody;
	try {
		body = await readDeepSearchRequestBody(request);
	} catch (error) {
		if (error instanceof DeepSearchRequestError) {
			return json({ error: error.message }, { status: 400 });
		}

		throw error;
	}

	const prompt = readPrompt(body.prompt);
	const currentDocumentId = readOptionalString(body.currentDocumentId);
	const ownerId = locals.user.id;
	const supabase = locals.supabase;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: string, data: unknown): void => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			try {
				send('ready', { prompt });

				const response = await searchDeepLibrary({
					supabase,
					ownerId,
					rawPrompt: prompt,
					currentDocumentId,
					abortSignal: request.signal,
					onStatus: (step: DeepLibrarySearchStatusStep) => {
						send('status', step);
					}
				});

				send('complete', {
					interpretedIntent: response.interpretedIntent,
					statusSteps: response.statusSteps,
					results: response.results
				});
			} catch (error) {
				console.error('[deep-library-search endpoint]', {
					ownerId,
					prompt,
					currentDocumentId,
					error: errorMessage(error, {
						operation: 'deep library search endpoint',
						params: {
							ownerId,
							prompt,
							currentDocumentId
						}
					})
				});

				const message =
					error instanceof Error && error.message.trim().length > 0
						? error.message
						: 'Deep search is unavailable right now.';
				send('error', { message });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};

class DeepSearchRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DeepSearchRequestError';
	}
}

async function readDeepSearchRequestBody(request: Request): Promise<DeepSearchRequestBody> {
	try {
		return (await request.json()) as DeepSearchRequestBody;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new DeepSearchRequestError('Request body must be valid JSON.');
		}

		throw error;
	}
}

function readPrompt(value: unknown): string {
	if (typeof value !== 'string') {
		throw new DeepSearchRequestError('Deep search prompt must be text.');
	}

	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed) {
		throw new DeepSearchRequestError('Enter a prompt to run Deep search.');
	}

	return trimmed;
}

function readOptionalString(value: unknown): string | null {
	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value !== 'string') {
		throw new DeepSearchRequestError('Current document id must be text.');
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}
