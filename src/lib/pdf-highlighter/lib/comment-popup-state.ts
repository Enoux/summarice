export type CommentPopupState = {
	comment: string;
	lastSavedComment: string;
	isSaving: boolean;
	isSuccess: boolean;
	error: string | null;
	successTimer: ReturnType<typeof setTimeout> | null;
};

export const COMMENT_SAVE_SUCCESS_DURATION_MS = 900;

export function createInitialCommentPopupState(comment = ''): CommentPopupState {
	return {
		comment,
		lastSavedComment: comment,
		isSaving: false,
		isSuccess: false,
		error: null,
		successTimer: null
	};
}

export function getCommentSaveDisabled(state: CommentPopupState) {
	const trimmed = state.comment.trim();
	if (state.isSaving) return true;
	if (!trimmed && !state.lastSavedComment) return false;
	return trimmed === state.lastSavedComment;
}

export function handleCommentDraftInput(state: CommentPopupState, value: string) {
	state.comment = value;
	state.error = null;
	clearCommentSaveSuccess(state);
}

export function clearCommentSaveSuccess(state: CommentPopupState) {
	state.isSuccess = false;
	if (state.successTimer) {
		clearTimeout(state.successTimer);
		state.successTimer = null;
	}
}

export async function handleCommentSave(
	state: CommentPopupState,
	onSave: (comment: string) => Promise<void>
): Promise<'saved' | 'noop' | undefined> {
	if (getCommentSaveDisabled(state)) return undefined;

	state.isSaving = true;
	state.error = null;
	state.isSuccess = false;
	const trimmed = state.comment.trim();
	const hadSavedComment = Boolean(state.lastSavedComment);

	try {
		if (trimmed || hadSavedComment) {
			await onSave(trimmed);
		}
		state.comment = trimmed;
		state.lastSavedComment = trimmed;
		if (!trimmed && !hadSavedComment) return 'noop';
		state.isSuccess = true;
		state.successTimer = setTimeout(() => {
			state.isSuccess = false;
			state.successTimer = null;
		}, COMMENT_SAVE_SUCCESS_DURATION_MS);
		return 'saved';
	} catch (error) {
		state.error = error instanceof Error ? error.message : 'Comment could not be saved.';
		return undefined;
	} finally {
		state.isSaving = false;
	}
}
