import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { createFigureInterpretationDraft } from '$lib/server/figures/figure-interpretation';

const CreateFigureInterpretationSchema = z.object({
	highlightId: z.string().uuid()
});

export const createFigureInterpretation = command(
	CreateFigureInterpretationSchema,
	async ({ highlightId }) => {
		const { locals, params } = getRequestEvent();
		const { supabase, user } = locals;
		if (!user) error(401, 'Unauthorized');
		if (!params.id) error(400, 'Missing document id');

		try {
			return await createFigureInterpretationDraft(supabase, {
				documentId: params.id,
				highlightId,
				ownerId: user.id
			});
		} catch (e) {
			console.error('[figure-interpretation remote]', e);
			error(400, e instanceof Error ? e.message : 'Could not create figure interpretation draft');
		}
	}
);
