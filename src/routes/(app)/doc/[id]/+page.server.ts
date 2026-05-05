import { error, isHttpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	ensureUserSettingsRow,
	fetchHighlightsForDocument,
	fetchUserSettings,
	rowToCommentedHighlight,
	rowToCommentedHighlightWithScreenshot
} from '$lib/server/highlights/highlight-service';
import { parseCategoryLabels } from '$lib/highlights/color-slots';

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	try {
		const { id } = params;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		// Fetch document metadata
		const { data: document, error: docError } = await supabase
			.from('documents')
			.select('*')
			.eq('id', id)
			.single();

		if (docError || !document) {
			throw error(404, 'Document not found');
		}

		const storagePath = document.storage_path;
		if (typeof storagePath !== 'string' || storagePath.length === 0) {
			console.error('[doc/+page.server] missing storage path', {
				documentId: id,
				ownerId: user.id
			});
			throw error(500, 'Document file is missing');
		}

		// Fetch signed URL for the PDF
		let storageData: { signedUrl: string } | null = null;
		let storageError: { message?: string } | null = null;
		try {
			const result = await supabase.storage.from('documents').createSignedUrl(storagePath, 43200); // 12 hour expiry
			storageData = result.data as { signedUrl: string } | null;
			storageError = result.error as { message?: string } | null;
		} catch (e) {
			console.error('[doc/+page.server] createSignedUrl crashed', {
				documentId: id,
				ownerId: user.id,
				storagePath,
				error: e
			});
			throw error(500, 'Could not generate signed URL');
		}

		if (storageError || !storageData) {
			console.error('[doc/+page.server] createSignedUrl failed', {
				documentId: id,
				ownerId: user.id,
				storagePath,
				storageError
			});
			throw error(500, 'Could not generate signed URL');
		}

		let settingsRow: Awaited<ReturnType<typeof fetchUserSettings>> = null;
		try {
			await ensureUserSettingsRow(supabase, user.id);
			settingsRow = await fetchUserSettings(supabase, user.id);
		} catch (settingsError) {
			console.warn('[doc/+page.server] user settings unavailable, using defaults', {
				documentId: id,
				userId: user.id,
				error: settingsError
			});
		}
		const categoryLabels = parseCategoryLabels(settingsRow?.category_labels);
		const useColorsDecoratively = settingsRow?.use_colors_decoratively ?? false;
		const decorativeDefaultColor = settingsRow?.decorative_default_color ?? '#facc15';

		let highlightsPayload: ReturnType<typeof rowToCommentedHighlight>[] = [];
		try {
			const rows = await fetchHighlightsForDocument(supabase, id);
			highlightsPayload = await Promise.all(
				rows.map((row) => rowToCommentedHighlightWithScreenshot(supabase, row))
			);
		} catch {
			// Table may not exist until migration is applied; viewer still loads.
			highlightsPayload = [];
		}

		return {
			document,
			pdfUrl: storageData.signedUrl,
			highlights: highlightsPayload,
			userSettings: {
				categoryLabels,
				useColorsDecoratively,
				decorativeDefaultColor
			}
		};
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error('[doc/+page.server] unexpected load error', {
			documentId: params.id,
			error: e
		});
		throw error(500, 'Failed to load document');
	}
};
