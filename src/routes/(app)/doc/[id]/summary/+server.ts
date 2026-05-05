import { error, json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase, user }, params }) => {
	if (!user) error(401, 'Unauthorized');
	if (!params.id) error(400, 'Missing document id');

	const { data: summaries, error: summariesError } = await supabase
		.from('summaries')
		.select(
			'*, citations:summary_citations(id, highlight_id, ordinal, occurrence_index)'
		)
		.eq('document_id', params.id)
		.eq('owner_id', user.id)
		.order('version', { ascending: false });

	if (summariesError) {
		console.error('[summary history]', summariesError);
		error(500, 'Could not load summary history');
	}

	return json({
		current: summaries?.find((summary) => summary.is_current) ?? null,
		versions: summaries ?? []
	});
};
