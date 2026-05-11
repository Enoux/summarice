import type { SupabaseClient } from '@supabase/supabase-js';

export type DeleteDocumentResult = {
	deleted: boolean;
	/** Non-fatal storage cleanup failures (DB row is already removed). */
	warnings: string[];
};

/**
 * Deletes a document row (Postgres cascades pages, highlights, summaries, etc.),
 * then removes the PDF and any area-highlight screenshots from Storage.
 */
export async function deleteDocumentForUser(
	supabase: SupabaseClient,
	opts: { documentId: string; userId: string }
): Promise<DeleteDocumentResult> {
	const warnings: string[] = [];

	const { data: doc, error: docErr } = await supabase
		.from('documents')
		.select('id, storage_path')
		.eq('id', opts.documentId)
		.eq('owner_id', opts.userId)
		.maybeSingle();

	if (docErr) throw docErr;
	if (!doc) {
		return { deleted: false, warnings };
	}

	const { data: highlights, error: hlErr } = await supabase
		.from('highlights')
		.select('screenshot_path')
		.eq('document_id', opts.documentId);

	if (hlErr) throw hlErr;

	const screenshotPaths = [
		...new Set(
			(highlights ?? [])
				.map((h) => h.screenshot_path)
				.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
		)
	];

	const pdfPath =
		typeof doc.storage_path === 'string' && doc.storage_path.trim().length > 0
			? doc.storage_path
			: null;

	const { error: delErr } = await supabase
		.from('documents')
		.delete()
		.eq('id', opts.documentId)
		.eq('owner_id', opts.userId);

	if (delErr) throw delErr;

	if (pdfPath) {
		const { error: pdfErr } = await supabase.storage.from('documents').remove([pdfPath]);
		if (pdfErr) {
			console.error('[deleteDocumentForUser] PDF storage cleanup failed', pdfErr);
			warnings.push(`Failed to remove PDF from storage: ${pdfErr.message}`);
		}
	}

	for (const path of screenshotPaths) {
		const { error: shotErr } = await supabase.storage.from('highlight-screenshots').remove([path]);
		if (shotErr) {
			console.error('[deleteDocumentForUser] screenshot cleanup failed', path, shotErr);
			warnings.push(`Failed to remove screenshot ${path}: ${shotErr.message}`);
		}
	}

	return { deleted: true, warnings };
}
