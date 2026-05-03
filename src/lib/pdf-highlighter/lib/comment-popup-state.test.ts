import { describe, expect, it, vi } from 'vitest';
import {
	COMMENT_SAVE_SUCCESS_DURATION_MS,
	createInitialCommentPopupState,
	getCommentSaveDisabled,
	handleCommentDraftInput,
	clearCommentSaveSuccess,
	handleCommentSave
} from './comment-popup-state';

describe('comment popup state', () => {
	it('allows empty drafts only when they delete an existing comment', () => {
		const state = createInitialCommentPopupState('Saved');

		expect(getCommentSaveDisabled(state)).toBe(true);

		handleCommentDraftInput(state, '   ');
		expect(getCommentSaveDisabled(state)).toBe(false);

		handleCommentDraftInput(state, 'Saved');
		expect(getCommentSaveDisabled(state)).toBe(true);

		handleCommentDraftInput(state, 'Changed');
		expect(getCommentSaveDisabled(state)).toBe(false);

		const emptyState = createInitialCommentPopupState('');
		expect(getCommentSaveDisabled(emptyState)).toBe(false);
		handleCommentDraftInput(emptyState, '   ');
		expect(getCommentSaveDisabled(emptyState)).toBe(false);
	});

	it('shows success only after persistence succeeds and clears after the delay', async () => {
		vi.useFakeTimers();
		const state = createInitialCommentPopupState('Saved');
		const onSave = vi.fn().mockResolvedValue(undefined);

		handleCommentDraftInput(state, 'Changed');
		const pending = handleCommentSave(state, onSave);
		expect(state.isSuccess).toBe(false);

		await pending;
		expect(state.isSuccess).toBe(true);
		expect(state.lastSavedComment).toBe('Changed');

		vi.advanceTimersByTime(COMMENT_SAVE_SUCCESS_DURATION_MS - 1);
		expect(state.isSuccess).toBe(true);
		vi.advanceTimersByTime(1);
		expect(state.isSuccess).toBe(false);
		vi.useRealTimers();
	});

	it('keeps the failed draft open and reports an inline error', async () => {
		const state = createInitialCommentPopupState('Saved');
		const onSave = vi.fn().mockRejectedValue(new Error('Nope'));

		handleCommentDraftInput(state, 'Attempted');
		await handleCommentSave(state, onSave);

		expect(state.comment).toBe('Attempted');
		expect(state.error).toBe('Nope');
		expect(state.isSuccess).toBe(false);
		expect(state.lastSavedComment).toBe('Saved');
	});

	it('clears success immediately when the user edits again', async () => {
		const state = createInitialCommentPopupState('Saved');
		handleCommentDraftInput(state, 'Changed');
		await handleCommentSave(state, vi.fn().mockResolvedValue(undefined));

		expect(state.isSuccess).toBe(true);
		handleCommentDraftInput(state, 'Changed again');
		expect(state.isSuccess).toBe(false);
	});

	it('clears success immediately when the comment box receives focus', async () => {
		const state = createInitialCommentPopupState('Saved');
		handleCommentDraftInput(state, 'Changed');
		await handleCommentSave(state, vi.fn().mockResolvedValue(undefined));

		expect(state.isSuccess).toBe(true);
		clearCommentSaveSuccess(state);
		expect(state.isSuccess).toBe(false);
		expect(state.successTimer).toBe(null);
	});

	it('saves an empty draft as comment deletion for existing comments', async () => {
		const state = createInitialCommentPopupState('Saved');
		const onSave = vi.fn().mockResolvedValue(undefined);

		handleCommentDraftInput(state, '   ');
		const result = await handleCommentSave(state, onSave);

		expect(result).toBe('saved');
		expect(onSave).toHaveBeenCalledWith('');
		expect(state.comment).toBe('');
		expect(state.lastSavedComment).toBe('');
		expect(state.isSuccess).toBe(true);
	});

	it('accepts an empty draft as a no-op when no comment exists', async () => {
		const state = createInitialCommentPopupState('');
		const onSave = vi.fn();

		handleCommentDraftInput(state, '   ');
		const result = await handleCommentSave(state, onSave);

		expect(result).toBe('noop');
		expect(onSave).not.toHaveBeenCalled();
		expect(state.comment).toBe('');
		expect(state.lastSavedComment).toBe('');
		expect(state.error).toBe(null);
	});
});
