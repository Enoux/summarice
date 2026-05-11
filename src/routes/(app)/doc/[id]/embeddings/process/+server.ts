import { error, json } from '@sveltejs/kit';
import { processDefaultPendingEmbeddings } from '$lib/server/embeddings/highlight-embedding-service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals: { supabase, user }, params }) => {
	if (!user) error(401, 'Unauthorized');

	try {
		const result = await processDefaultPendingEmbeddings(supabase, {
			ownerId: user.id,
			documentId: params.id
		});
		return json(result);
	} catch (e) {
		console.error('[highlight-embeddings process]', {
			documentId: params.id,
			error: e instanceof Error ? e.message : String(e)
		});
		error(500, 'Failed to process highlight embeddings');
	}
};
