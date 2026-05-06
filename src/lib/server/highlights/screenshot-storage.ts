import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';

const SCREENSHOT_BUCKET = 'highlight-screenshots';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;

export type StoredHighlightScreenshot = {
	path: string;
	signedUrl: string | null;
};

function decodePngDataUrl(dataUrl: string): Uint8Array | null {
	const match = /^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/i.exec(dataUrl);
	if (!match) return null;
	return new Uint8Array(Buffer.from(match[1], 'base64'));
}

export function highlightScreenshotPath(opts: {
	userId: string;
	documentId: string;
	highlightId: string;
}) {
	return `${opts.userId}/${opts.documentId}/${opts.highlightId}.png`;
}

export async function uploadHighlightScreenshot(
	supabase: SupabaseClient,
	opts: {
		userId: string;
		documentId: string;
		highlightId: string;
		imageDataUrl?: string;
		path?: string;
	}
): Promise<StoredHighlightScreenshot | null> {
	if (!opts.imageDataUrl) return null;

	const bytes = decodePngDataUrl(opts.imageDataUrl);
	if (!bytes) return null;

	const path = opts.path ?? highlightScreenshotPath(opts);
	const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, bytes, {
		contentType: 'image/png',
		upsert: true
	});
	if (error) throw error;

	return {
		path,
		signedUrl: await createHighlightScreenshotSignedUrl(supabase, path)
	};
}

export async function createHighlightScreenshotSignedUrl(
	supabase: SupabaseClient,
	path: string | null | undefined
) {
	if (!path) return null;
	const { data, error } = await supabase.storage
		.from(SCREENSHOT_BUCKET)
		.createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
	if (error || !data) return null;
	return data.signedUrl;
}

export async function removeHighlightScreenshot(supabase: SupabaseClient, path: string | null) {
	if (!path) return;
	await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
}
