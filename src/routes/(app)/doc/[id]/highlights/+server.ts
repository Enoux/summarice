import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import {
	createHighlightRpc,
	deleteHighlightById,
	updateHighlight
} from '$lib/server/highlights/highlight-service';

const ScaledSchema = z.object({
	x1: z.number(),
	y1: z.number(),
	x2: z.number(),
	y2: z.number(),
	width: z.number(),
	height: z.number(),
	pageNumber: z.number().int().positive()
});

const CreateHighlightSchema = z.object({
	highlight: z.object({
		id: z.string().uuid().optional(),
		type: z.enum(['text', 'area']).optional(),
		position: z.object({
			boundingRect: ScaledSchema,
			rects: z.array(ScaledSchema).default([]),
			usePdfCoordinates: z.boolean().optional()
		}),
		content: z.object({ text: z.string().optional(), image: z.string().optional() }).optional(),
		comment: z.string().optional(),
		color_index: z.number().int().min(0).max(4).optional(),
		category_slot: z.number().int().min(1).max(5).nullable().optional(),
		display_color: z.string().optional()
	}),
	decorative: z.boolean(),
	colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
});

const PatchHighlightSchema = z.object({
	id: z.string().uuid(),
	category: z.number().int().min(1).max(5).nullable().optional(),
	color: z.string().optional(),
	comment: z.string().nullable().optional()
});

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const parsed = CreateHighlightSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const { highlight, decorative, colorHex } = parsed.data;

	try {
		const created = await createHighlightRpc(locals.supabase, highlight as any, {
			documentId: params.id,
			decorative,
			colorHex
		});
		return json(created);
	} catch (e) {
		console.error('[highlights POST]', e);
		error(500, 'Failed to create highlight');
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const parsed = PatchHighlightSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const { id, ...patch } = parsed.data;

	try {
		await updateHighlight(locals.supabase, id, params.id, patch);
		return json({ ok: true });
	} catch (e) {
		console.error('[highlights PATCH]', e);
		error(500, 'Failed to update highlight');
	}
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing id');

	try {
		await deleteHighlightById(locals.supabase, id);
		return json({ ok: true });
	} catch (e) {
		console.error('[highlights DELETE]', e);
		error(500, 'Failed to delete highlight');
	}
};
