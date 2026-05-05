import type { HighlightsModel } from '$lib/pdf-highlighter';
import type { CommentedHighlight } from '$lib/pdf-highlighter/types';

export type HighlightCommentSaveResult =
	| { ok: true; comment: string }
	| { ok: false; reason: 'missing-id'; message: string }
	| { ok: false; reason: 'persistence'; message: string; error: unknown };

export type PersistHighlightComment = (
	highlight: CommentedHighlight,
	comment: string
) => Promise<void>;

export function createHighlightCommentSaver(
	highlightsStore: HighlightsModel<CommentedHighlight>,
	persist: PersistHighlightComment
) {
	return async (
		highlight: CommentedHighlight,
		comment: string
	): Promise<HighlightCommentSaveResult> => {
		const trimmed = comment.trim();
		if (!highlight.id) {
			return {
				ok: false,
				reason: 'missing-id',
				message: 'This highlight is not ready to save yet.'
			};
		}

		const current = highlightsStore.getHighlightById(highlight.id);
		const previousComment = current?.comment ?? highlight.comment ?? '';

		highlightsStore.editHighlight(highlight.id, { comment: trimmed });

		try {
			await persist(current ?? highlight, trimmed);
			return { ok: true, comment: trimmed };
		} catch (error) {
			highlightsStore.editHighlight(highlight.id, { comment: previousComment });
			return {
				ok: false,
				reason: 'persistence',
				message: 'Comment could not be saved. Please try again.',
				error
			};
		}
	};
}
